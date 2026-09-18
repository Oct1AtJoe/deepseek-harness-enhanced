# Local Changes — deepseek-harness

> 与上游 `deepseek-ai/deepseek-harness` 对比的本地修改记录。
> 拉取上游更新后，按此文档重新应用。

---

## 1. Fix: CREATE_DEFAULT_ERROR_MODE 语义修正

**问题**：`CREATE_DEFAULT_ERROR_MODE` 标志语义被用反，导致 `SEM_NOGPFAULTERRORBOX` 无法被子进程继承，受限 token 下的 cmd.exe/git.exe 崩溃弹窗。

**MSDN 文档**：
```
CREATE_DEFAULT_ERROR_MODE (0x04000000)
  → 子进程**不继承**父进程错误模式，改用系统默认值。
  不传此标志 → 子进程默认继承父进程错误模式。
```

### 修改文件

#### `packages/sandbox/sandbox-windows-acl/src/spawn.ts`

```diff
// 第 128 行 (spawnSandboxed — 管道 I/O 路径)
-    0 | abi.CREATE_DEFAULT_ERROR_MODE,
+    0,

// 第 312 行 (spawnSandboxedInherited — 继承 I/O 路径)
-    abi.CREATE_SUSPENDED | abi.CREATE_DEFAULT_ERROR_MODE,
+    abi.CREATE_SUSPENDED,
```

#### `packages/sandbox/sandbox-windows-acl/src/runner.ts`

```diff
// 第 135-137 行 注释修正
-  // The child inherits this error mode via CREATE_DEFAULT_ERROR_MODE.
+  // Omit CREATE_DEFAULT_ERROR_MODE when spawning so the child
+  // naturally inherits this error mode — and, by default, its own children inherit it too.
```

```diff
// 模块级 SetErrorMode — 在 import 之后、main() 之前立即执行
+ import { win32, win32Sync } from './ffi.ts'
+ win32Sync().setErrorMode(abi.SEM_NOGPFAULTERRORBOX)
```

#### `packages/sandbox/sandbox-windows-acl/src/win32-abi.ts`

```diff
-  /** CREATE_DEFAULT_ERROR_MODE: the child inherits the caller's error-mode preference ... */
+  /** CREATE_DEFAULT_ERROR_MODE: the child does NOT inherit the caller's error mode — use system default. Keep OUT. */

-  /** SEM_NOGPFAULTERRORBOX: suppress ... for this process and its children (when CREATE_DEFAULT_ERROR_MODE is passed). */
+  /** SEM_NOGPFAULTERRORBOX: suppress Application Error dialog. Omit CREATE_DEFAULT_ERROR_MODE so children inherit. */
```

### 验证方法

```powershell
# 子进程是否继承 SEM_NOGPFAULTERRORBOX
parent SetErrorMode(2)
CreateProcess(child) → child SetErrorMode(0) → 返回值含 0x2 说明已继承
```

---

## 2. Add: WER 崩溃对话框抑制

**问题**：`SEM_NOGPFAULTERRORBOX` 仅抑制 CRT 级崩溃对话框，Windows 10+ 的 Windows Error Reporting (WER) 对话框独立于 `SetErrorMode`，需通过注册表禁用。即使 `DontShowUI=1` 对部分崩溃类型无效，所以额外加 `ExcludedApplications`。

### 修改文件

#### `packages/sandbox/sandbox-policy/src/index.ts`

两个机制在 `SandboxPolicyService` 构造函数的 `ctx.effect()` 中：

```typescript
// 新增 import
import { spawnSync } from 'node:child_process'

// 完整添加的代码段（在 constructor 中 super() 之后）：
ctx.effect(() => {
  if (process.platform !== 'win32') return () => {}
  let previousRs: string | undefined
  try {
    // 1. DontShowUI — 抑制 WER 标准对话框
    const current = spawnSync('reg', [
      'query', 'HKCU\\Software\\Microsoft\\Windows\\Windows Error Reporting',
      '/v', 'DontShowUI',
    ], { stdio: 'pipe', encoding: 'utf8', timeout: 3000 })
    if (current.status === 0 && current.stdout !== null) {
      const match = /DontShowUI\s+REG_DWORD\s+(0x[0-9a-fA-F]+)/u.exec(current.stdout)
      if (match !== null) previousRs = match[1]
    }
    spawnSync('reg', [
      'add', 'HKCU\\Software\\Microsoft\\Windows\\Windows Error Reporting',
      '/v', 'DontShowUI', '/t', 'REG_DWORD', '/d', '1', '/f',
    ], { stdio: 'ignore', timeout: 3000 })

    // 2. ExcludedApplications — 对易崩溃的 exe 彻底关闭 WER
    const excludedExes = ['node.exe', 'cmd.exe', 'powershell.exe', 'pwsh.exe', 'git.exe']
    for (const exe of excludedExes) {
      spawnSync('reg', [
        'add', 'HKCU\\Software\\Microsoft\\Windows\\Windows Error Reporting\\ExcludedApplications',
        '/v', exe, '/t', 'REG_DWORD', '/d', '1', '/f',
      ], { stdio: 'ignore', timeout: 3000 })
    }
  } catch {
    // 非致命
  }
  return () => {
    try {
      // DSH 退出时恢复 DontShowUI 原值
      if (previousRs !== undefined) {
        spawnSync('reg', [
          'add', 'HKCU\\Software\\Microsoft\\Windows\\Windows Error Reporting',
          '/v', 'DontShowUI', '/t', 'REG_DWORD', '/d', previousRs, '/f',
        ], { stdio: 'ignore', timeout: 3000 })
      } else {
        spawnSync('reg', [
          'delete', 'HKCU\\Software\\Microsoft\\Windows\\Windows Error Reporting',
          '/v', 'DontShowUI', '/f',
        ], { stdio: 'ignore', timeout: 3000 })
      }
    } catch { /* 非致命 */ }
  }
})
```

---

## 3. Fix: 主进程 SetErrorMode + 补充 WER 排除列表

**问题**：上一轮修复仅在 runner（沙箱子进程）中设置 `SetErrorMode(SEM_NOGPFAULTERRORBOX)`，
但未在 DSH 主进程（Node.js 服务器）中设置。当 pwsh 7 的 .NET 运行时启动时可能清除继承的
错误模式，导致 `where.exe`/`winget.exe`/`git.exe` 等孙子进程的 CRT "Application Error" 弹窗
无法被抑制。

另外 WER `ExcludedApplications` 列表中缺少 `where.exe` 和 `winget.exe`，
导致它们在崩溃时仍然弹出 WER 对话框。

### 修改文件

#### `packages/sandbox/sandbox-windows-acl/src/index.ts`

在模块加载时同步调用 `SetErrorMode(SEM_NOGPFAULTERRORBOX | SEM_FAILCRITICALERRORS)`，
使主 DSH 进程及其所有子进程（runner → pwsh → where.exe/winget.exe）都继承错误模式抑制。

```typescript
// 新增 import
import { ... , win32Sync } from './ffi.ts'

// 模块级调用（在 import 之后、class 定义之前）：
if (process.platform === 'win32') {
  try {
    win32Sync().setErrorMode(abi.SEM_NOGPFAULTERRORBOX | abi.SEM_FAILCRITICALERRORS)
  } catch {
    // koffi 不可用时静默失败
  }
}
```

#### `packages/sandbox/sandbox-policy/src/index.ts`

在 WER ExcludedApplications 列表中补充 `where.exe` 和 `winget.exe`。

```diff
- const excludedExes = ['node.exe', 'cmd.exe', 'powershell.exe', 'pwsh.exe', 'git.exe']
+ const excludedExes = ['node.exe', 'cmd.exe', 'powershell.exe', 'pwsh.exe', 'git.exe', 'where.exe', 'winget.exe']
```

---

## 4. Chore: 清理 fork 内 ecosystem 残留（dead mappings + 重复 msg-nav 包）

**背景**：自定义插件已全部提取到 `C:\dsh-ecosystem\plugins\`，由 web profile 通过 pnpm
`link:` 依赖加载。仓库内残留的 TypeScript path mappings 指向不存在的目录（dead
reference），且 `packages/client/ui-msg-nav` 与生态版 src 完全重复（运行时装载的是生态版）。

### 修改

- `tsconfig.base.json`：删除 7 条 ecosystem path mappings
  （ui-theme-custom / ui-session-reference / ui-deliverables-custom / ui-resend-failed-round /
  ui-subagent-custom / dsh-notification-custom / ui-msg-nav）。`lib: ["esnext", ...]`
  功能补丁保留。
- 删除 `packages/client/ui-msg-nav/`（src 与 `C:\dsh-ecosystem\plugins\ui-msg-nav` 完全一致）。
- `.gitignore` 的 `desktop-tauri/*`、`packages/data/kanye-pet/state.json` 等条目**保留**：
  对应目录仍以未跟踪形式存在于本地工作树（构建产物 / 运行时数据），条目正在服务。

### Profile 侧变化（不在本仓库）

- `~/.dsh/profiles/web/package.json`：9 个自定义插件依赖从 `file:` 改为 pnpm 原生 `link:`
  协议；`postinstall` 与 `C:\dsh-ecosystem\ensure-junctions.js` 已删除——`pnpm install`
  不再破坏插件链接。
- 生态 `C:\dsh-ecosystem\plugins\package.json` 补充 Node-half 插件运行时依赖
  （schemastery / zod / @deepseek-ai/schemastery，symlink 包从真实路径解析）与 tsdown 构建依赖。

---

## 5. Fix: `dsh web` 默认不弹浏览器，改为 `--open` 显式开启

**提交**：`8095536399`（2026-08-22）

**问题**：`openBrowser` 默认 `true`，每次 `dsh web` 启动都自动拉起系统默认浏览器。多实例、远程访问、脚本化启动场景下持续产生干扰窗口。

### 修改文件

#### `packages/bundle/web-app/src/index.ts`

```diff
 export const Config: z<Config> = z.object({
-  openBrowser: z.boolean().default(true),
+  openBrowser: z.boolean().default(false),
```

#### `packages/bundle/web-app/src/startup.ts`

```diff
-    .option('--no-open', 'do not open the Web UI in the default browser')
+    .option('--open', 'open the Web UI in the default browser after startup')
```

#### `apps/cli/tests/web-browser-open.snapshot.ts`

两处 argv 补 `'--open'`（opt-in 后必须显式传才触发 opener）。

---

## 6. Fix: vendor cordis `const enum FiberState` 不 emit 运行时值

**提交**：`1025300435`（2026-08-30）

**问题**：`const enum` 成员在编译期被内联，**不生成运行时对象**。lib 模式消费者（逐文件 emit、或跨包按值引用 `FiberState.X`）拿到 `undefined`，运行期崩溃。

### 修改文件

#### `vendor/cordis/src/fiber.ts`

```diff
- export const enum FiberState {
+ export enum FiberState {
    PENDING,
```

### 通用规则

本仓库中**任何会被跨包按值引用的枚举一律用 `enum`，不用 `const enum`**。遇到 `undefined is not a function` / `Cannot read properties of undefined` 且指向枚举成员时，先查是否 `const enum`。

---

## 7. Fix: `import type` 擦除导致运行时值缺失

**提交**：`0ecc22c882`（2026-09-14）

**问题**：`SessionLogOffset` 是 branded 运行时函数，却被写在 `import type { ... }` 里。类型导入编译后整体擦除，冷投影列表路径调用它时 `ReferenceError`。

### 修改文件

#### `packages/api/session-controller/src/list.ts`

```diff
- import type { Session, SessionEvent, SessionHeader, SessionId } from '@deepseek-ai/dsh-session'
+ import { SessionLogOffset, type Session, type SessionEvent, type SessionHeader, type SessionId } from '@deepseek-ai/dsh-session'
```

> 注：该调用点在 #8 中已改为可选参数并移除，但**同类风险规则保留**：值与类型混用时，值必须走非 `type` 导入。

---

## 8. Fix: seeded 冷会话在列表里读不到缓存标题

**提交**：`e195383680`（2026-09-17，`bc34a04504` 为 rebase 重复）

**问题**：`ApiSessionList` 冷路径对 `header.isSeeded` 直接返回 `undefined`，导致种子会话在会话列表里标题始终空白，必须等会话被真正打开、投影水合后才出现。

根因是 checkpoint 身份要求精确的 `inheritedEventCount`，而冷列表只有 header，拿不到这个切点。

### 修改文件

#### `packages/session/session-projection-cache/src/index.ts`

```diff
 type CurrentCheckpointIdentity = CheckpointIdentity & {
   formatVersion: number
   isSeeded: boolean
-  inheritedEventCount: SessionLogOffset
+  inheritedEventCount?: SessionLogOffset
 }

   cachedSnapshot(
     meta: SessionHeader,
-    inheritedEventCount: SessionLogOffset,
+    inheritedEventCount?: SessionLogOffset,
     keys?: readonly Extract<keyof SessionProjectionMap, string>[],
   ): ProjectionSnapshot | undefined {
```

省略 `inheritedEventCount` 时为 best-effort hint 读，按 `createdAt` + `cwd` + `isSeeded` 匹配；严格传精确切点的调用方继续拒绝不匹配的 checkpoint。`cachedPredecessorTitle` 同步改为可选。

#### `packages/api/session-controller/src/list.ts`

```diff
-      const block = session === undefined
-        ? header.isSeeded
-          ? undefined
-          : cache?.cachedSnapshot(header, SessionLogOffset(0))
-            ?? cache?.cachedPredecessorTitle(header, SessionLogOffset(0))
-        : this.ctx.sessionProjections.cachedSnapshot(session)
+      const block = session === undefined
+        ? cache?.cachedSnapshot(header)
+          ?? cache?.cachedPredecessorTitle(header)
+        : this.ctx.sessionProjections.cachedSnapshot(session)
```

**已知边界**：会话在打开前被原地 re-seed，可能读到上一代的值。会话真正打开后由 history tail 基线覆盖为权威值。

---

## 9. Fix: GFM 单波浪号把中文数字区间误渲染成删除线

**状态**：本轮修复，尚未提交

**问题**：`packages/client/ui-primitives/src/markdown/parse.ts` 无参调用 `gfm()`，继承 `micromark-extension-gfm-strikethrough` 的默认 `singleTilde: true`——任意两个孤立 `~` 即配对成删除线。

半角 `~` 是中文与技术文本里的常规区间分隔符（`15~40 秒`、`16:00~18:30`），因此模型输出**必然**高频触发：

```
每天下午 16:00~18:30 …… 排队 15~40 秒
      ↑ 定界符 1                  ↑ 定界符 2  → 中间整段被 <del> 划掉
```

流式渲染下更严重：实测前 40 个字符正常显示，第 41 个字符（第二个 `~`）落地瞬间，**已经稳定呈现、读者可能已读完的 22 个字符追溯性回跳为删除线**。

这不是规范偏离（GFM 默认即如此，GitHub 相同），而是**默认值与本仓库场景不匹配**，且与本目录 `cjkFriendlyStrong()` 已确立的"CommonMark/GFM 空白与标点假设对 CJK 不成立，需覆盖"方向一致。

### 修改文件

#### `packages/client/ui-primitives/src/markdown/parse.ts`

两个渲染臂**必须同时改**（settled 语法 = streaming 语法 + math，只改一处会造成两臂不一致）：

```diff
-    extensions: [gfm(), cjkFriendlyStrong()],
+    extensions: [gfm({ singleTilde: false }), cjkFriendlyStrong()],
```

```diff
-    extensions: [gfm(), cjkFriendlyStrong(), mathCompatibility(), math()],
+    extensions: [gfm({ singleTilde: false }), cjkFriendlyStrong(), mathCompatibility(), math()],
```

> `gfm()` **没有**关闭 strikethrough 的开关：`micromark-extension-gfm@3.0.0` 无条件把 options 透传给 `gfmStrikethrough(options)`。传 `{ strikethrough: false }` 无效，只有 `singleTilde` 这个粒度。`~~text~~` 双波浪号删除线不受影响。

#### `packages/client/ui-primitives/tests/markdown.client.spec.tsx`

新增回归守卫 `keeps a lone tilde range separator out of strikethrough`，同时 pin 两件事：单 `~` 不划线、`~~` 仍划线。

### 验证方法

```powershell
pnpm vitest run packages/client/ui-primitives/tests/markdown.client.spec.tsx `
  packages/client/ui-primitives/tests/markdown-dom-parity.client.spec.tsx `
  packages/client/ui-primitives/tests/markdown-incremental.client.spec.tsx
# 113 passed

pnpm run typecheck:contracts-ready   # exit 0
```

反向验证：临时回退 `singleTilde` 后该测试确实失败，报
`AssertionError: expected '40 秒与 16:00' to be '真删除'`——正是 bug 的复现形态。

---

## 重建

```sh
pnpm run build:lib
```

然后**重启 DSH**。

---

## 相关提交

```
214ee4f8bf feat: add 4 glassmorphism themes + crash-dialog fix
8095536399 fix(web): change browser-open default to false, add --open flag      (#5)
1025300435 fix(vendor): emit runtime FiberState export for lib-mode consumers    (#6)
0ecc22c882 fix(session-controller): import SessionLogOffset runtime value        (#7)
e195383680 fix(session): serve cached title for seeded cold sessions             (#8)
（#9 GFM singleTilde 本轮修复，尚未提交）
```
