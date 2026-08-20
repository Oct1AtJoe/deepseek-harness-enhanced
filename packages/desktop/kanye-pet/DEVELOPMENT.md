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
    size: z.number().min(100).max(600).default(300),  // ← 这里改范围
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
    "core:window:allow-start-dragging",
    "core:window:allow-set-size"
  ]
}
```

> **坑点**：
> - `windows` 数组必须包含 `"pet"`，否则 pet 窗口无法使用任何 IPC
> - `core:window:default` **不包含** `allow-set-size`，必须显式添加
> - 权限缺失时 IPC 报错：`window.set_size not allowed. Permissions associated with this command: core:window:allow-set-size`

### 3.3 IPC 调用

**拖拽窗口**（`pet.js`）：

```javascript
await window.__TAURI_INTERNALS__.invoke('plugin:window|start_dragging')
```

**调整窗口尺寸**（`pet.js`）：

```javascript
await window.__TAURI_INTERNALS__.invoke('plugin:window|set_size', {
  value: { Logical: { width: winSize, height: winSize } },
})
```

> **坑点**：`set_size` 的参数格式是 `{ value: { Logical: { width, height } } }`，不是 `{ width: { type: 'Logical', value: N } }`。

### 3.4 pet.js 核心逻辑

```javascript
// 拖拽处理
pet.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  e.preventDefault()
  void startDrag()  // 调用 invoke('plugin:window|start_dragging')
})

// 配置轮询（每 2s）
async function pollConfig() {
  const res = await fetch(CONFIG_URL)  // http://127.0.0.1:3080/kanye-pet/config
  const body = await res.json()
  const config = body?.config ?? body  // ← 注意嵌套结构
  applyConfig(config)
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
  if (field === 'size' && (num < 100 || num > 600)) return { text: staged.text, invalid: true }
  if (field === 'opacity' && (num < 0.2 || num > 1)) return { text: staged.text, invalid: true }
  return { text: staged.text, invalid: false }
}
```

---

## 五、构建与部署

### 5.1 Debug vs Release

| | Debug | Release |
|---|---|---|
| 命令 | `tauri build --debug` | `tauri build` |
| 编译 | 无优化，快 | 全优化，慢（~50s） |
| 体积 | ~16MB | ~3-5MB |
| devtools | 有（F12） | 无 |
| 用途 | 开发调试 | 发布 |

### 5.2 关键构建步骤

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

### 5.3 DSH 服务加载优先级

Tauri exe 启动 DSH 服务的逻辑（`spawn_dsh`）：

1. 检查 `DSH_DESKTOP_BACKEND` 环境变量（完整 argv 覆盖）
2. **开发模式**：检测源码仓库 `apps/cli/src/bin.ts` 是否存在，存在则用 `node --import tsx/esm` 运行
3. 兜底：查找全局安装的 `@deepseek-ai/dsh`（npm/pnpm）

> **坑点**：Tauri exe 会**复用**端口 33080 上已有的 DSH 服务。如果旧服务还在运行，即使重启 exe 也不会加载新代码。必须：
> - 关闭 Tauri exe
> - 杀掉旧 node 进程
> - 重新双击 exe

### 5.4 WebView 缓存

Tauri WebView2 有独立缓存。代码更新后如果行为不对，清除缓存：

```powershell
Remove-Item "$env:LOCALAPPDATA\ai.deepseek.harness.desktop\EBWebView" -Recurse -Force
```

---

## 六、避坑清单

| # | 坑 | 解决方案 |
|---|-----|---------|
| 1 | config.mjs 改了但限制没变 | DSH 服务运行的是全局安装版，不是源码。需重启 DSH 或用源码启动 |
| 2 | 保存时值被重置到 160 | host Zod schema 还是旧的 `max(160)`。改 `config.mjs` 后重建并重启 DSH |
| 3 | 设置面板显示范围不对 | 三层同步改：config.mjs + controller + locales.ts |
| 4 | 桌宠窗口无法拖拽 | 缺 `core:window:allow-start-dragging` 权限 |
| 5 | set_size IPC 报错 missing required key value | 参数格式错，应为 `{ value: { Logical: { width, height } } }` |
| 6 | set_size 不生效 | 窗口 `resizable(false)` 阻止了 resize，改为 `true` |
| 7 | 桌宠显示三个复制体 | `background-size: contain` 导致多帧可见，改为 `100% 100%` |
| 8 | 桌宠底部地球被裁 | pet div 尺寸不够，窗口 260x260 + `background-position: center bottom` |
| 9 | 拖拽时精灵抖动 | 拖拽中 `background-position` 持续更新，需暂停帧动画 |
| 10 | 修改后刷新页面没用 | WebView 缓存旧 JS，需清缓存或重启 exe |
| 11 | 新 exe 启动后旧 DSH 还在 | Tauri 复用端口 3080 的已有服务，需先杀旧进程 |
| 12 | 找不到 `__TAURI_INTERNALS__` | pet.html 必须通过 Tauri webview 加载（`tauri://` 协议），不能直接浏览器打开 |

---

## 七、相关文件清单

```
packages/desktop/kanye-pet/
├── lib/src/config.mjs              # Host schema + 默认值
├── lib/src/routes.mjs              # HTTP 路由
├── lib/client/index.mjs            # Client half（已禁用）
├── lib/client.js                   # Client half 构建产物（空壳）
├── cordis.patch.yml                # 宿主组合挂载
└── assets/manifest.json            # 角色 sprite 清单

packages/client/ui-kanye-pet/
├── src/client/KanyeCard.tsx        # 设置卡片 UI
├── src/client/kanye-card-controller.ts  # 表单 + 校验
├── src/client/locales.ts          # 文案
└── lib/client.js                   # 构建产物

desktop-tauri/
├── src-tauri/src/lib.rs            # Tauri 主程序（窗口创建 + DSH 启动）
├── src-tauri/capabilities/default.json  # 权限配置
├── src/pet.html                    # 桌宠窗口 HTML
├── src/pet.js                      # 桌宠窗口逻辑
└── src-tauri/target/debug/dsh-desktop.exe  # Debug 产物
```

---

## 八、扩展指南

### 8.1 新增角色

1. 在 `kanye-pet/assets/characters/<id>/` 放置 sprite sheet
2. 在 `assets/manifest.json` 的 `characters` 对象中添加角色定义
3. 每个角色需要 15 个状态的 sprite（`verify-assets` 门禁强制）

### 8.2 新增配置项

1. 在 `config.mjs` 的 `buildSchema()` 中添加 Zod 字段
2. 在 `DEFAULTS` 中添加默认值
3. 在 `ui-kanye-pet` 的 `KanyeSettings` interface 中添加字段
4. 在 `KanyeCard.tsx` 中添加 UI 控件
5. 在 `kanye-card-controller.ts` 中添加校验
6. 在 `locales.ts` 中添加文案

### 8.3 调试技巧

```javascript
// pet.js 中加可见调试指示器
const dbg = document.createElement('div')
dbg.style.cssText = 'position:fixed;top:0;left:0;font:9px monospace;color:#0f0;background:rgba(0,0,0,.8);padding:1px 3px;z-index:99999'
document.body.appendChild(dbg)
dbg.textContent = 'debug info'
```
