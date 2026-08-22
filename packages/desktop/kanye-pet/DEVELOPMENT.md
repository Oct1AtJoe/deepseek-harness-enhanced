# Kanye-Pet 内置桌宠插件开发文档

## 一、插件架构

### 1.1 双端分离（Host / Client Split）

Kanye-pet 是一个 **双端插件**（dual-face plugin），由两个独立半部分组成：

```
kanye-pet/
├── lib/
│   ├── index.mjs          # Host half（Node 端）
│   ├── src/
│   │   ├── config.mjs      # Zod schema、默认值
│   │   ├── routes.mjs      # HTTP 路由（/state, /config, /assets）
│   │   └── ...
│   ├── client/
│   │   └── index.mjs       # Client half（浏览器端，浮宠渲染）
│   └── client.js           # Client half 构建产物（__ModuleLoader__ 壳）
└── cordis.patch.yml        # 宿主组合挂载描述
```

| 半部分 | 运行位置 | 职责 | 加载方式 |
|--------|---------|------|---------|
| **Host half** | Node.js / DSH 服务 | 提供资产、状态、配置 REST API | `cordis.patch.yml` 行 `id: kanye-pet` |
| **Client half** | 浏览器 / Webview | 渲染浮宠、处理交互 | `__ModuleLoader__.load({ id, factory })` |

### 1.2 Tauri 桌面窗 vs Web GUI 浮宠

Kanye-pet 有 **两个独立的宠物渲染通道**，互不依赖：

| 通道 | 入口 | 渲染技术 | 控制方式 |
|------|------|---------|---------|
| **Tauri 透明窗口** | `desktop-tauri/src/pet.html` + `pet.js` | CSS background sprite 动画 | 独立 exe 渲染 |
| **Web GUI 浮宠** | `kanye-pet/lib/client/index.mjs` | DOM + CSS + Canvas | 浏览器内嵌 |

> **关键决策**：内置化后，**Web GUI 浮宠已禁用**（`apply` 返回空 disposer），仅保留 Tauri 桌面窗。

### 1.3 数据流

```
设置面板（ui-kanye-pet）
    ↓ edit('size', value) → staged
    ↓ save() → scope.set('size', value)
    ↓
DSH Settings Namespace（kanye-pet）
    ↓ Zod schema 校验（config.mjs）
    ↓ 持久化
    ↓
/kanye-pet/config 端点（routes.mjs）
    ↓ 轮询（每 2s）
    ↓
Tauri pet.js → applyConfig() → 重设窗口尺寸/透明度/角色

---- 通知链路（桌宠气泡接管，v3 终版） ----

用户发消息 → agent 处理 → turn 结束（turn/end 写入 session.events）
    ↓ turn/end 不通过 session/event 广播，但下一条事件到来时
    ↓ kanye-pet 扫描 session.events 发现新 turn/end → 读 reason.kind
    ↓ completed → 任务完成 / error → 任务出错 / aborted/interrupted → 任务中止
    ↓ 写 petNotification 单槽队列
    ↓
/kanye-pet/state 端点 → notification 字段
    ↓ 轮询（每 2s）
    ↓
Tauri pet.js → pollState() → showBubble() → 气泡显示 8s
    ↓ 点击气泡
    ↓
pet_open_session (Tauri command) → show_main + open_session
    ↓ eval `dsh:open-session` CustomEvent
    ↓ dsh-notification-custom 客户端监听 → sessions.open(id)
```

---

## 二、配置系统

### 2.1 Zod Schema（Host 端，权威）

`packages/desktop/kanye-pet/lib/src/config.mjs`：

```javascript
export function buildSchema() {
  return z.object({
    enabled: z.boolean().default(true),
    desktopPetEnabled: z.boolean().default(true),
    size: z.number().min(100).max(300).default(150),  // ← 这里改范围/默认值
    opacity: z.number().min(0.2).max(1).default(1),
    character: z.string().default('kanye'),
    walk: z.object({ /* ... */ }),
  })
}
```

> **坑点**：Zod schema 是保存时的**最后一道关卡**。即使前端校验通过，host 端校验失败也会拒绝写入并回滚。

### 2.2 默认值单一来源

`config.mjs` 中的 `DEFAULTS` 对象是默认值的单一来源。浏览器 half 的 `CFG_DEFAULTS` 必须与此一致（`verify-config-sync` 门禁守护）。

### 2.3 三个校验层必须同步

| 层 | 文件 | 作用 |
|----|------|------|
| Host schema | `kanye-pet/lib/src/config.mjs` | 服务端保存时校验 |
| Client validation | `ui-kanye-pet/.../kanye-card-controller.ts` | 前端实时校验 |
| Locale hint | `ui-kanye-pet/.../locales.ts` | 用户看到的范围提示 |

> **坑点**：改范围/默认值时，**三层必须同步改**，否则会出现前端显示一个范围、保存时又被拒绝的情况。

---

## 三、Tauri 桌面窗

### 3.1 窗口创建

`desktop-tauri/src-tauri/src/lib.rs` 中的 `setup` 函数：

```rust
let _pet_window = tauri::WebviewWindowBuilder::new(app, "pet", tauri::WebviewUrl::App("pet.html".into()))
    .title("桌宠 Kanye")
    .inner_size(260.0, 260.0)
    .position(pet_pos.0, pet_pos.1)
    .always_on_top(true)
    .decorations(false)
    .resizable(true)        // ← 必须 true，否则 set_size IPC 无效
    .transparent(true)
    .shadow(false)
    .skip_taskbar(true)
    .build()?;
```

> **坑点**：`resizable(false)` 会阻止程序化 `set_size` API 生效。需要 resize 时必须设为 `true`。

### 3.2 权限系统（Tauri 2 Capabilities）

`desktop-tauri/src-tauri/capabilities/default.json`：

```json
{
  "windows": ["main", "pet"],
  "permissions": [
    "core:default",
    "notification:default",
    "core:window:default",
    "core:window:allow-set-size",
    "core:window:allow-set-position",
    "core:window:allow-outer-position"
  ]
}
```

> **坑点**：
> - `windows` 数组必须包含 `"pet"`，否则 pet 窗口无法使用任何 IPC
> - `core:window:default` **不包含** `allow-set-size`、`allow-set-position`、`allow-outer-position`，必须显式添加
> - `allow-start-dragging` **已废弃**：拖拽改用 `set_position` 手动移窗（见 3.3），不再依赖系统拖拽 API
> - 权限缺失时 IPC 报错：`window.set_size not allowed. Permissions associated with this command: ...`
> - 自定义命令（如 `pet_open_session`）默认无需 capability 声明即可由窗口调用

### 3.3 IPC 调用

**拖拽窗口**（`pet.js`）—— 手动 `set_position`，不触发 Windows Snap：

```javascript
// pointerdown → setPointerCapture → pointermove → set_position
// 不用 Tauri start_dragging（避免触发 Windows Aero Snap）
let winX = 0, winY = 0           // 本地追踪窗口位置
let dragState = null              // { offsetX, offsetY }

function handlePointerDown(e) {
  dragState = {
    offsetX: e.screenX - winX,   // 记录鼠标相对窗口的偏移
    offsetY: e.screenY - winY,
  }
  pet.setPointerCapture(e.pointerId)
}

function handlePointerMove(e) {
  if (!dragState) return
  winX = e.screenX - dragState.offsetX
  winY = e.screenY - dragState.offsetY
  scheduleSetPosition(winX, winY) // RAF 节流后 invoke
}
```

**调整窗口尺寸**（`pet.js`）：

```javascript
await window.__TAURI_INTERNALS__.invoke('plugin:window|set_size', {
  value: { Logical: { width: winSize, height: winSize } },
})
```

> **坑点**：
> - `set_size` 的参数格式是 `{ value: { Logical: { width, height } } }`，不是 `{ width: { type: 'Logical', value: N } }`
> - 手动拖拽使用 `screenX/screenY`（CSS 逻辑像素），传给 `set_position` 时用 `Logical` 类型
> - `setPointerCapture` 保证鼠标移出 pet 元素仍收 `pointermove` 事件；但移出 OS 窗口后会丢失

### 3.4 pet.js 核心逻辑

```javascript
// 拖拽处理（手动 set_position，无 Windows Snap）
let winX = 0, winY = 0
let dragState = null
let dragRafId = null
let pendingPos = null

function scheduleSetPosition(x, y) {
  pendingPos = { x: Math.round(x), y: Math.round(y) }
  if (!dragRafId) {
    dragRafId = requestAnimationFrame(() => {
      // 只发最后一帧位置，避免 IPC 风暴
      invoke('plugin:window|set_position', {
        value: { Logical: { x: pendingPos.x, y: pendingPos.y } },
      }).catch(() => {})
      pendingPos = null
    })
  }
}

function setupDrag() {
  pet.addEventListener('pointerdown', handlePointerDown)
  pet.addEventListener('pointermove', handlePointerMove)
  pet.addEventListener('pointerup', handlePointerUp)
  pet.addEventListener('pointercancel', handlePointerUp)
}

// 配置轮询（每 2s）
async function pollConfig() {
  const res = await fetch(CONFIG_URL)  // http://127.0.0.1:3080/kanye-pet/config
  const body = await res.json()
  const config = body?.config ?? body  // ← 注意嵌套结构
  applyConfig(config)
  // manifest 未加载时重试（DSH 刚启动时 assets 端点可能未就绪）
  if (!manifestReady) void loadManifest()
}

// 应用配置
async function applyConfig(config) {
  const show = config.desktopPetEnabled !== false
  document.body.style.opacity = show ? String(config.opacity ?? 1) : '0'
  document.body.style.pointerEvents = show ? 'auto' : 'none'
  const newSize = Math.min(600, Number(config.size))
  if (Number.isFinite(newSize) && newSize > 0) {
    await invoke('plugin:window|set_size', { value: { Logical: { width: winSize, height: winSize } } })
  }
}
```

### 3.5 Sprite 渲染

使用 CSS `background-image` + `background-position` 实现帧动画：

```css
#pet {
  width: 100%; height: 100%;
  background-repeat: no-repeat;
  background-position: center bottom;  /* 锚定底部，地球不被裁 */
}
```

```javascript
// background-size: 100% 100% → 每帧填满容器
// 百分比选帧：pct = frame / (frames - 1) * 100
pet.style.backgroundSize = `${set.frames * 100}% 100%`
pet.style.backgroundPosition = `${pct}% 0`
```

> **坑点**：`background-size: contain` 会露出多帧（显示多个复制体），必须用 `100% 100%`。

### 3.6 精灵图透明边距（已修复 2026-08-21）

- **历史现象**：窗口 260×260，精灵图每帧 256×256，但角色实际只占画面中心约 60-80px
- **根因**：精灵图导出时留了过多透明 padding，属素材设计问题
- **修复**：2026-08-21 用 `Bitmap.Clone` 将 15 个状态的 PNG 从 256×256 帧裁剪为 122×207 帧（union bbox (68,24)-(189,230)），原始文件备份在 `originals_bak/`。因 assets 路由设 `immutable` 缓存，文件名从 `.v2.png` 改为 `.v3.png`
- **涉及文件**：`packages/desktop/kanye-pet/lib/assets/characters/kanye/*.v2.png`（15 个文件）
- **相关改动**：`manifest.json` 的 `stageSize` 从 256→207；`desktop-tauri/src-tauri/src/lib.rs` 窗口尺寸对应调整

---

## 四、设置面板（ui-kanye-pet）

### 4.1 包结构

```
packages/client/ui-kanye-pet/
├── package.json            # @deepseek-ai/dsh-client-ui-kanye-pet
├── src/
│   ├── index.ts            # Host half（空壳，仅注册）
│   ├── invariant.ts        # 包级不变量
│   └── client/
│       ├── index.ts        # Client half apply 入口
│       ├── KanyeCard.tsx   # React 组件（设置卡片 UI）
│       ├── kanye-card-controller.ts  # 表单状态机 + 校验
│       └── locales.ts      # 中英文文案
└── lib/
    └── client.js           # tsdown 构建产物（__ModuleLoader__ 壳）
```

### 4.2 加载路径

- **URL**：`/plugins/@deepseek-ai/dsh-client-ui-kanye-pet/client.js`
- **包名** = 插件 ID = 目录名前缀 `ui-kanye-pet`
- **构建**：`npx tsdown`（tsdown.config.ts 配置）

### 4.3 staged 编辑模式

```
用户输入 → staged Map（内存草稿）
    ↓ 点击保存
    ↓ scope.set(field, value) → DSH Settings Service
    ↓ host Zod schema 校验
    ↓ 成功 → staged.clear() + store 更新
    ↓ 失败 → 回滚（值恢复到保存前）
```

### 4.4 校验逻辑

```typescript
private field(field: 'size' | 'opacity'): KanyeFieldState {
  const staged = this.staged.get(field)
  if (staged === undefined) {
    const value = this.value()?.[field]
    return { text: typeof value === 'number' ? String(value) : '', invalid: false }
  }
  const trimmed = staged.text.trim()
  if (trimmed === '' || !Number.isFinite(Number(trimmed)))
    return { text: staged.text, invalid: trimmed !== '' }
  const num = Number(trimmed)
  if (field === 'size' && (num < 100 || num > 300)) return { text: staged.text, invalid: true }
  if (field === 'opacity' && (num < 0.2 || num > 1)) return { text: staged.text, invalid: true }
  return { text: staged.text, invalid: false }
}
```

### 4.5 重置按钮硬编码

`ui-kanye-pet/src/client/KanyeCard.tsx` 中每个 `NumberField` 的 `onReset` 直接写死了重置值：

```tsx
onReset={() => { props.edit('size', '150') }}     // ← 改默认值时同步改这里
onReset={() => { props.edit('opacity', '1') }}    // ← 透明度默认值
```

> **坑点**：改 `DEFAULTS.size` 时，**必须同时改 KanyeCard.tsx 里的 reset 硬编码**，否则点重置会恢复到旧值。

---

## 五、通知系统（气泡通知，v3 终版）

### 5.1 触发规范（与 dsh-notification-custom 对齐）

| 规则 | 说明 |
|------|------|
| 触发时机 | **主对话 turn 结束**（turn/end 写入 session.events） |
| 与回复内容无关 | 不看 assistant/message 内容 |
| 子进程不触发 | 子进程 job 完成（onJobDone）**不**直接发通知 |
| 只看主对话 | 只看主 session 的 turn/end |
| 状态映射 | `completed` → 任务完成 / `error` → 任务出错 / `aborted`/`interrupted` → 任务中止 |

### 5.2 实现机制（关键：turn/end 不通过 session/event 广播）

**核心认知**：`ctx.on('session/event', ...)` 只能收到 `assistant/chunk`、`assistant/message`、`tool/call` 等事件，**收不到 `turn/start`/`turn/end`**。但 `turn/end` 会写入 `session.events`（Session 对象的完整日志）。

**检测算法**：
1. `lastTurnEndNotif` Map（sessionId → seq）记录每个 session 已通知过的最后 turn/end 位置
2. **首次**遇到某个 session 时，扫描其 events 找到最后一个 turn/end 记录 seq，**不通知**（跳过历史）
3. 后续每条事件到来时，扫描 events 找 `seq > lastSeq` 的 turn/end，发现即通知
4. 通知标题从 `turn/end.data.reason.kind` 映射

```javascript
// lib/index.mjs session/event handler 内的核心逻辑（示意）
if (!lastTurnEndNotif.has(id)) {
  // 首次：只记录最后 turn/end 位置，不通知历史
  let lastSeq = -1
  for (const e of events) {
    if (e?.type === 'turn/end' && (e.seq ?? 0) > lastSeq) lastSeq = e.seq
  }
  if (lastSeq >= 0) lastTurnEndNotif.set(id, lastSeq)
} else {
  const lastSeq = lastTurnEndNotif.get(id) ?? -1
  for (const e of events) {
    if (e?.type === 'turn/end' && (e.seq ?? 0) > lastSeq) {
      // 发通知 + lastTurnEndNotif.set(id, e.seq)
    }
  }
}
```

### 5.3 Windows 通知抑制（ShimNotification）

`desktop-tauri/src-tauri/src/lib.rs` 的 `bridge_init_script` 注入 `ShimNotification` 拦截所有 `new Notification(...)`：

```
new Notification(...)
  → ShimNotification 构造器
  → fetch /kanye-pet/config 查 desktopPetEnabled
  → desktopPetEnabled === false → bridge.fire()（Windows 通知）
  → desktopPetEnabled !== false → 直接抑制（由 kanye-pet turn 检测/轮询驱动气泡）
  → fetch 失败 → bridge.fire()（兜底 Windows）
```

> **注意**：桌面宠物窗口（pet.html/pet.js）没有注入 ShimNotification，只有主窗口（main）注入了。ShimNotification 的作用是把浏览器里 dsh-notification-custom 发起的 `new Notification()` 转成 Windows Toast；桌宠启用时统一由 kanye-pet 气泡接管，不再区分 pending 与非 pending。

### 5.4 通知链路细节

| 环节 | 实现 |
|------|------|
| 通知队列 | 单槽 `petNotification`（最新覆盖旧），60s TTL 防残留 |
| tag 去重 | pet.js `lastNotifTag` 防轮询重复显示 |
| 气泡时长 | 8s 自动消失 |
| 点击跳转 | `pet_open_session`(Tauri command) → `show_main` + `open_session` → eval `dsh:open-session` CustomEvent → dsh-notification-custom 监听 `sessions.open(id)`；点击后气泡立即消失 |
| 会话标题兜底链 | `resolveSessionTitle` → `session.label` → `session.id`（启动初期标题未就绪时兜底） |
| 延迟 | turn/end 写入 log 后，下一条 session/event 到来时检测（通常毫秒级） |

### 5.5 通知触发源的演进（历史，勿回退）

| 版本 | 触发源 | 问题 |
|------|--------|------|
| v1 | `onJobDone` | 只覆盖子进程 job，纯对话 turn 不触发 |
| v2 | `assistant/message` | 频次太高：命令结果、子智能体都发 |
| v3（终版） | 扫描 `session.events` 的 turn/end | 与 dsh-notification-custom 同源，一次 turn 一条 |

### 5.6 通知系统架构（v4 终版）

kanye-pet 的通知系统通过三个检测路径覆盖所有需要通知用户的场景：

#### 5.6.1 三条检测路径

| 路径 | 触发事件 | 覆盖场景 | 延迟 |
|------|---------|---------|------|
| **turn/end 扫描** | `session/event` 回调时扫描 `session.events` | 所有 turn/end（completed/error/aborted/interrupted/max-tokens） | 下一事件到达时 |
| **approval/asked 检测** | `session/event` 回调中 `event.type === 'approval/asked'` | 工具审批（sandbox_permissions 等） | 即时 |
| **tool/call 快速路径** | `session/event` 回调中 `event.data.name` 匹配 | `ask_user_question` / `exit_plan_mode` | 即时 |

#### 5.6.2 标题映射

```javascript
// turn/end reason kind → 通知标题（TITLE_MAP）
completed  → 任务完成
error      → 任务出错
aborted    → 任务中止
interrupted→ 任务中止
blocked    → 等待你的操作    // 注：实际不产生 turn/end blocked
max-tokens → Token 已超限

// pending interaction kind → 通知标题（PENDING_TITLE_MAP）
question    → 需要你的选择    // ask_user_question
plan-review → 请评审计划      // exit_plan_mode
approval    → 等待你的审批    // approval/asked 事件
```

#### 5.6.3 单槽队列

`petNotification` 是单槽变量，每次设通知覆盖上一条。TTL 60s，超时后 `/state` 端点自动清除。

#### 5.6.4 点击消失

`pet.js` 的 `showBubble` 创建的气泡点击后立即隐藏并清除定时器（`clearTimeout` + `display: none`），同时调用 `pet_open_session` 跳转会话。

#### 5.6.5 关键坑点

- **工具审批不产生 turn/end blocked**：审批等待时 turn 保持 OPEN，批准后直接 `completed`。必须靠 `approval/asked` 事件检测
- **`ask_user_question` / `exit_plan_mode` 不产生 turn/end**：工具 async 等待用户回答，turn 不结束。必须靠 tool/call 快速路径
- **ShimNotification 对 pending 标签的特判**：原逻辑对 `-pending-` 标签通知永远走 Windows，与 pet 气泡重复。改为统一查 `desktopPetEnabled`（见 5.3）

### 5.7 通知提示音

kanye-pet 支持通知音效，默认为 Web Audio API 合成音，可通过自定义 wav 文件覆盖。

#### 5.7.1 音效映射

| 通知类型（reason） | 合成音效 | 自定义文件名 |
|-------------------|---------|------------|
| `completed` | C5→E5 上行双音「叮叮」 | `complete.wav` |
| `question` / `plan-review` / `approval`（pending 类） | A4 柔和单音「叮」 | `pending.wav` |
| `error` | 200→100Hz 锯齿波下坠「嗡」 | `error.wav` |
| 其他兜底 | 660Hz 短促「啵」 | `notify.wav` |

#### 5.7.2 自定义音效

在 `kanye-pet/lib/assets/sounds/` 放置对应文件名的 `.wav` 文件，pet.js 自动优先加载：

```
lib/assets/sounds/
├── complete.wav     # 任务完成
├── pending.wav      # 审批/提问/评审
├── error.wav        # 任务出错
└── notify.wav       # 兜底
```

pet.js 通过 `HEAD /kanye-pet/assets/sounds/<name>.wav` 检查文件是否存在，存在则用 `new Audio(url)` 播放，不存在则回退到 Web Audio API 合成。

**不需重编 exe**，放好文件重启 DSH 即可。

#### 5.7.3 实现细节

- 音效播放位于 `desktop-tauri/src/pet.js` 的 `playNotifSound(reason)` 函数
- 服务器 `/state` 端点返回的 `notification` 对象包含 `reason` 字段（如 `'completed'`、`'question'`、`'approval'`），pet.js 据此选择音效
- Web Audio API 上下文懒初始化（首次播放时才创建 `AudioContext`）
- 合成音改用 `OscillatorNode` + `GainNode` 实现，带缓起缓落防爆音
- 自定义 wav 播放音量固定 0.3

---

## 六、构建与部署

### 6.1 Debug vs Release

| | Debug | Release |
|---|---|---|
| 命令 | `tauri build --debug` | `tauri build` |
| 编译 | 无优化，快 | 全优化，慢（~50s） |
| 体积 | ~16MB | ~3-5MB |
| devtools | 有（F12） | 无 |
| 用途 | 开发调试 | 发布 |

### 6.2 关键构建步骤

```bash
# 1. 重建所有客户端包（ui-kanye-pet 等）
pnpm run build

# 2. 重建 Tauri exe
cd desktop-tauri
npx tauri build --debug    # 或 npx tauri build（release）

# 3. 产物位置
# debug:   desktop-tauri/src-tauri/target/debug/dsh-desktop.exe
# release: desktop-tauri/src-tauri/target/release/dsh-desktop.exe
```

### 6.3 ⚠️ Tauri 前端资源缓存（本次最大坑）

**现象**：改了 `pet.js`/`pet.html` 后重编 exe，跑起来还是旧行为，`/kanye-pet/state` 请求根本不出现。

**根因**：`tauri-build` 的 build script 只对 `frontendDist` **目录本身**发出 `cargo:rerun-if-changed`，**不跟踪目录内文件内容变化**。改文件内容不触发 build script 重跑，嵌入 exe 的仍是旧压缩资源。

**验证方法**：检查 `target/release/build/dsh-desktop-*/out/tauri-codegen-assets/` 里的文件名。文件名是内容的 BLAKE3 hash，改了文件 hash 应变化；hash 不变说明 build script 没重跑。

**解决方案**（任一）：
```powershell
# 方案 1：删 build 产物目录强制重跑
Remove-Item "desktop-tauri/src-tauri/target/release/build/dsh-desktop-*" -Recurse -Force
cd desktop-tauri; npx tauri build

# 方案 2：完全清 target（最稳，但全量重编 ~2.5min）
Remove-Item "desktop-tauri/src-tauri/target" -Recurse -Force
cd desktop-tauri; npx tauri build
```

### 6.4 DSH 服务加载优先级

Tauri exe 启动 DSH 服务的逻辑（`spawn_dsh`）：

1. 检查 `DSH_DESKTOP_BACKEND` 环境变量（完整 argv 覆盖）
2. **开发模式**：检测源码仓库 `apps/cli/src/bin.ts` 是否存在，存在则用 `node --import tsx/esm` 运行
3. 兜底：查找全局安装的 `@deepseek-ai/dsh`（npm/pnpm）

> **坑点**：Tauri exe 会**复用**端口 3080 上已有的 DSH 服务。如果旧服务还在运行，即使重启 exe 也不会加载新代码（lib/index.mjs 改动需重启 DSH 生效）。必须：
> - 关闭 Tauri exe
> - 杀掉旧 node 进程（`Get-Process node | Stop-Process`）
> - 重新双击 exe

### 6.5 WebView 缓存

Tauri WebView2 有独立缓存。代码更新后如果行为不对，清除缓存：

```powershell
Remove-Item "$env:LOCALAPPDATA\ai.deepseek.harness.desktop\EBWebView" -Recurse -Force
```

---

## 七、避坑清单

| # | 坑 | 解决方案 |
|---|-----|---------|
| 1 | config.mjs 改了但限制没变 | DSH 服务运行的是全局安装版，不是源码。需重启 DSH 或用源码启动 |
| 2 | 保存时值被重置到 160 | host Zod schema 还是旧的 `max(160)`。改 `config.mjs` 后重建并重启 DSH |
| 3 | 设置面板显示范围不对 | 三层同步改：config.mjs + controller + locales.ts |
| 4 | 桌宠窗口拖拽触发 Windows Snap | `start_dragging` 触发系统拖拽激活 Aero Snap。改用手动 `pointermove` + `set_position` 绕开 |
| 5 | set_size IPC 报错 missing required key value | 参数格式错，应为 `{ value: { Logical: { width, height } } }` |
| 6 | set_size 不生效 | 窗口 `resizable(false)` 阻止了 resize，改为 `true` |
| 7 | 桌宠显示三个复制体 | `background-size: contain` 导致多帧可见，改为 `100% 100%` |
| 8 | 桌宠底部地球被裁 | pet div 尺寸不够，窗口 260x260 + `background-position: center bottom` |
| 9 | 拖拽时精灵抖动 | 拖拽中 `background-position` 持续更新，需暂停帧动画 |
| 10 | 修改后刷新页面没用 | WebView 缓存旧 JS，需清缓存或重启 exe |
| 11 | 新 exe 启动后旧 DSH 还在 | Tauri 复用端口 3080 的已有服务，需先杀旧进程 |
| 12 | 找不到 `__TAURI_INTERNALS__` | pet.html 必须通过 Tauri webview 加载（`tauri://` 协议），不能直接浏览器打开 |
| 13 | 保存设置后值被回退成旧值 | 写入被拒：Windows 下 `settings.yaml` 被其他进程持句柄时 rename 报 EPERM。`dsh-atomic-write` 已有 unlink+rename 回退 |
| 14 | lib/index.mjs 加载报错（SyntaxError） | 文件有无效 UTF-8 字节（中文第三字节被 `?` 替换），导致字符串缺失闭合引号、注释吞代码。需从 git 恢复后用 fix-v5.mjs 修复 |
| 15 | DSH 启动后插件不生效（404） | `cordis.patch.yml` 中 kanye-pet 行被注释。检查 bundle 的 patch 层是否启用 |
| 16 | Tauri 打开了但桌宠窗口空白 | pet window 需要 `capabilities.default.json` 的 `windows` 数组包含 `"pet"`；缺此权限所有 IPC 均不可用 |
| 17 | ⚠️ 改 pet.js/pet.html 后重编 exe 不生效 | Tauri build script 只跟踪 frontendDist 目录本身，不跟踪文件内容。删 `target/release/build/dsh-desktop-*` 或整个 target 重编（见 6.3） |
| 18 | 点击气泡无反应 | 确认 `pet_open_session` 命令已注册（`invoke_handler`）；pet.js 里 invoke 参数名 `sessionId` 与 Rust 命令参数 `session_id` 的 serde 转换（Tauri 自动 camelCase，`session_id` ↔ `sessionId` 正确） |
| 19 | Windows 通知仍弹（桌宠启用时） | 确认 ShimNotification 走对分支：只有 `desktopPetEnabled === false` / fetch 失败才 fire。所有通知（含 pending）统一查桌宠开关。另注意 `task_notifier_script` 必须走 `new Notification()` 而非直呼 `bridge.fire()`（绕过 shim） |
| 20 | 气泡被窗口裁剪 | 气泡必须放在窗口可视区域内（`bottom: 6px`），`bottom: calc(100% - 6px)` 会把气泡推到窗口外被裁掉 |
| 21 | 气泡标题和正文挤在一行 | pet.js `showBubble()` 里 `display: 'block'` 会覆盖 CSS 的 `display: flex; flex-direction: column`。必须用 `display: 'flex'` |
| 22 | 气泡底部透明蒙版 | `box-shadow` 在透明窗口内形成半透明渐变带。去掉 box-shadow、用纯色背景+实色边框 |
| 23 | ⚠️ 双通知（气泡 + Windows Toast） | ShimNotification 转发到已删除的 `/kanye-pet/notify` 端点 → 404 → catch 兜底 fire → Windows Toast。转发失败不应兜底 fire；桌宠启用时直接抑制 |
| 24 | ⚠️ 通知两头空（pet 部分损坏） | kanye-pet 插件 config 端点活着但 turn 检测不工作时，ShimNotification 抑制 Windows 通知、pet 气泡也没有 → 通知丢失。排查 `/kanye-pet/state` 的 notification 字段与日志 `[kanye-pet] turn/end` |
| 25 | onJobDone 不触发（纯对话） | `onJobDone` 只对子进程 job 触发，纯对话 turn 不经过它。通知不能以 onJobDone 为唯一源 |
| 26 | assistant/message 触发通知太频繁 | 命令结果、子智能体回复都会产生 assistant/message。通知必须按 turn/end 粒度（见 5.2） |
| 27 | 启动时通知历史 turn | 首次扫描 session.events 时只记录 lastTurnEndNotif 位置不通知，否则重启后把所有历史 turn 都通知一遍 |
| 28 | 启动时桌宠透明（manifest 加载失败） | `loadManifest()` 只调一次，DSH 未就绪时失败后不重试。在 `pollConfig()` 里加 `if (!manifestReady) void loadManifest()` 重试 |
| 29 | 精灵图角色显示很小 | 精灵图每帧透明 padding 过多（见 3.6，待解决） |
| 30 | PowerShell 测 curl JSON 报 invalid JSON | `Set-Content -Encoding UTF8` 会加 BOM 导致 `JSON.parse` 失败；单引号包裹的 JSON 也会被 PowerShell 转义破坏。用 `[System.IO.File]::WriteAllText(..., [UTF8Encoding]::new($false))` 写无 BOM 文件 + `curl --data-binary "@file"` |
| 31 | 会话标题未就绪显示"未命名会话" | 启动初期 `resolveSessionTitle` 返回 null。兜底链：`resolveSessionTitle` → `session.label` → `session.id` |
| 32 | ⚠️ 工具审批通知两头空（无气泡、无 Windows） | 工具审批**不产生 turn/end blocked**（turn 保持 OPEN）。不能靠 turn/end 扫描，必须检测 `approval/asked` 事件（§5.6.1） |
| 33 | ⚠️ ask_user_question / exit_plan_mode 无通知 | 工具 async 等待时 turn 不结束，不产生 turn/end。必须靠 `tool/call` 快速路径（§5.6.1） |
| 34 | ⚠️ pending 通知与 Windows toast 重复 | ShimNotification 原逻辑对 `-pending-` 标签永远走 Windows。改 pending 通知也查 `desktopPetEnabled`（§5.3） |

---

## 八、相关文件清单

```
packages/desktop/kanye-pet/
├── lib/index.mjs               # Host half（通知队列 + turn 检测 + 路由）
├── lib/src/config.mjs          # Host schema + 默认值
├── lib/src/routes.mjs          # HTTP 路由
├── lib/src/session-events.mjs  # turn 边沿判定（parseTurnEvent）
├── lib/client/index.mjs        # Client half（已禁用）
├── lib/client.js               # Client half 构建产物（空壳）
├── cordis.patch.yml            # 宿主组合挂载
└── assets/manifest.json        # 角色 sprite 清单

packages/client/ui-kanye-pet/
├── src/client/KanyeCard.tsx    # 设置卡片 UI
├── src/client/kanye-card-controller.ts  # 表单 + 校验
├── src/client/locales.ts       # 文案
└── lib/client.js               # 构建产物

desktop-tauri/
├── src-tauri/src/lib.rs        # Tauri 主程序（窗口 + DSH 启动 + ShimNotification + pet_open_session）
├── src-tauri/capabilities/default.json  # 权限配置
├── src/pet.html                # 桌宠窗口 HTML（气泡 CSS）
├── src/pet.js                  # 桌宠窗口逻辑（拖拽 + 轮询 + sprite + 气泡）
├── src-tauri/target/debug/dsh-desktop.exe   # Debug 产物
└── src-tauri/target/release/dsh-desktop.exe # Release 产物
```

---

## 九、扩展指南

### 9.1 新增角色

1. 在 `kanye-pet/assets/characters/<id>/` 放置 sprite sheet
2. 在 `assets/manifest.json` 的 `characters` 对象中添加角色定义
3. 每个角色需要 15 个状态的 sprite（`verify-assets` 门禁强制）

### 9.2 新增配置项

1. 在 `config.mjs` 的 `buildSchema()` 中添加 Zod 字段
2. 在 `DEFAULTS` 中添加默认值
3. 在 `ui-kanye-pet` 的 `KanyeSettings` interface 中添加字段
4. 在 `KanyeCard.tsx` 中添加 UI 控件 + **reset 硬编码**
5. 在 `kanye-card-controller.ts` 中添加校验
6. 在 `locales.ts` 中添加文案
7. 若影响桌宠窗口尺寸，同步改 `desktop-tauri/src/pet.js` 的 `applyConfig` 和 `lib.rs` 的初始窗口

> **坑点**：改默认值时，reset 硬编码（§4.5）、schema default、`DEFAULTS`、前端校验、locale 提示、`pet.js` 的 `Math.min` 上限**六处必须同步**。

### 9.3 lib/index.mjs 损坏修复

`lib/index.mjs` 是手写的 Cordis 插件入口，曾因 UTF-8 字节损坏导致无法加载：

- **症状**：Node.js 报 `SyntaxError: Unexpected token 'export'`（实际是注释和字符串里的中文第三字节被 `?` 替换）
- **损坏模式**：中文字符 `务`（`E5 8A A1`）→ `E5 8A 3F`（第三字节变 `?`），导致：
  - 字符串字面量闭合引号丢失（`'未命名任务'` → `'未命名任`）
  - `//` 注释与后续代码行合并，`import`/`const`/`let`/`ctx.`/`...(`/`})` 被吞
- **修复工具**：项目内附 `fix-v5.mjs`（已删除，可从 git 历史找回），自动修复 43 处合并 + 2 处字符串

```bash
# 从修复脚本恢复（该脚本已删除，若需要请从 git 历史获取）
git show <commit>:packages/desktop/kanye-pet/fix-v5.mjs > fix-v5.mjs
```

> **预防**：编辑 `lib/index.mjs` 时只能用纯 UTF-8 编辑器（VS Code、Vim），避免 GBK/GB2312 编码工具。文件包含大量中文注释，编码转换会直接破坏字符。

### 9.4 调试技巧

```javascript
// pet.js 中加可见调试指示器
const dbg = document.createElement('div')
dbg.style.cssText = 'position:fixed;top:0;left:0;font:9px monospace;color:#0f0;background:rgba(0,0,0,.8);padding:1px 3px;z-index:99999'
document.body.appendChild(dbg)
dbg.textContent = 'debug info'
```

### 9.5 排查链路速查

| 症状 | 查什么 |
|------|--------|
| 桌宠气泡不出现 | `curl http://127.0.0.1:3080/kanye-pet/state` 看 notification 字段；DSH 日志查 `[kanye-pet] turn/end` |
| 通知内容不对 | 检查 turn/end 的 `reason.kind` 映射；标题兜底链是否命中 |
| Windows 通知和气泡同时弹 | ShimNotification 是否误走 `fire()`；`/kanye-pet/notify` 端点是否残留 |
| 点击气泡不跳转 | DSH 日志查 `会话跳转事件派发失败`；sessionId 是否为空；dsh-notification-custom 是否加载 |
| 桌宠透明 | manifest.json 是否 200；`loadManifest` 重试是否生效 |
| 改动不生效 | ① 清 WebView 缓存 ② 杀 node 重启 exe ③ 删 build 产物重编（6.3） |

### 9.6 经验总结

1. **Tauri 前端资源打包有缓存**，改 pet.js/pet.html 必须删 build 产物重编（见 6.3），否则白改
2. **会话事件有两套通道**：`session/event` 广播（部分事件）与 `session.events` 完整日志。turn/start/turn/end 只在日志里，要轮询/扫描日志才能感知
3. **通知语义要对齐 dsh-notification-custom**：它按 turn 投影推进触发，一次 turn 一条；不要用 onJobDone（只覆盖 job）或 assistant/message（太频繁）
4. **三条通知检测路径缺一不可**：turn/end 扫描覆盖正常完成；`approval/asked` 覆盖工具审批；`tool/call` 快速路径覆盖 `ask_user_question`/`exit_plan_mode`。工具审批不产生 `turn/end blocked`，`ask_user_question` 不产生任何 turn/end（§5.6.1）
5. **ShimNotification 的 pending 特判**：原逻辑对 pending 标签永远走 Windows，与 pet 气泡重复。统一查 `desktopPetEnabled` 后，所有通知由 pet 气泡接管（§5.3）
6. **透明窗口的视觉坑**：box-shadow、半透明背景、窗口外定位都会产生诡异视觉效果，气泡用纯色 + 窗口内定位
7. **host 端改动（lib/index.mjs）无需重编 exe**，重启 DSH 即生效；pet.js/pet.html/lib.rs 改动必须重编 exe
8. **验证 exe 是否包含新前端代码**：解压 `target/release/build/dsh-desktop-*/out/tauri-codegen-assets/*.js`（Brotli 压缩），检查内容 hash 是否变化或直接解压比对
