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
-    0 | abi.CREATE_DEFAULT_ERROR_MODE, // no creation flags except inherit error mode
+    0, // no CREATE_DEFAULT_ERROR_MODE → child inherits SEM_NOGPFAULTERRORBOX

// 第 312 行 (spawnSandboxedInherited — 继承 I/O 路径)
-    abi.CREATE_SUSPENDED | abi.CREATE_DEFAULT_ERROR_MODE, // inherit error mode to suppress crash dialogs
+    abi.CREATE_SUSPENDED, // no CREATE_DEFAULT_ERROR_MODE → child inherits SEM_NOGPFAULTERRORBOX
```

#### `packages/sandbox/sandbox-windows-acl/src/runner.ts`

```diff
// 第 135-137 行 注释修正
-  // The child inherits this error mode via CREATE_DEFAULT_ERROR_MODE.
+  // Omit CREATE_DEFAULT_ERROR_MODE when spawning so the child
+  // naturally inherits this error mode — and, by default, its own children inherit it too.
```

#### `packages/sandbox/sandbox-windows-acl/src/win32-abi.ts`

```diff
// 第 152-155 行 JSDoc 修正
-  /** CREATE_DEFAULT_ERROR_MODE: the child inherits the caller's error-mode preference ... */
+  /** CREATE_DEFAULT_ERROR_MODE: the child does NOT inherit the caller's error mode — it gets the system default instead. Keep this flag OUT to propagate SEM_NOGPFAULTERRORBOX. */

-  /** SEM_NOGPFAULTERRORBOX: suppress ... for this process and its children (when CREATE_DEFAULT_ERROR_MODE is passed). */
+  /** SEM_NOGPFAULTERRORBOX: suppress Application Error dialog. Omit CREATE_DEFAULT_ERROR_MODE so children inherit the suppression. */
```

### 验证方法

```powershell
# 经验测试：子进程是否继承 SEM_NOGPFAULTERRORBOX
parent SetErrorMode(2)
CreateProcess(child) → child SetErrorMode(0) → 返回值含 0x2 说明已继承
```

---

## 2. Add: WER 崩溃对话框抑制

**问题**：`SEM_NOGPFAULTERRORBOX` 仅抑制 CRT 级崩溃对话框，Windows 10+ 的 Windows Error Reporting (WER) 对话框独立于 `SetErrorMode`，需通过注册表禁用。

### 修改文件

#### `packages/sandbox/sandbox-policy/src/index.ts`

在 `SandboxPolicyService` 构造函数中添加 `ctx.effect()` 生命周期：

```typescript
// 新增 import
import { spawnSync } from 'node:child_process'

// 在 constructor 中 super() 之后添加
ctx.effect(() => {
  if (process.platform !== 'win32') return () => {}
  let previousRs: string | undefined
  try {
    // 读取当前值
    const current = spawnSync('reg', [
      'query', 'HKCU\\Software\\Microsoft\\Windows\\Windows Error Reporting',
      '/v', 'DontShowUI',
    ], { stdio: 'pipe', encoding: 'utf8', timeout: 3000 })
    if (current.status === 0 && current.stdout !== null) {
      const match = /DontShowUI\s+REG_DWORD\s+(0x[0-9a-fA-F]+)/u.exec(current.stdout)
      if (match !== null) previousRs = match[1]
    }
    // 设为 1 禁用 WER UI
    spawnSync('reg', [
      'add', 'HKCU\\Software\\Microsoft\\Windows\\Windows Error Reporting',
      '/v', 'DontShowUI', '/t', 'REG_DWORD', '/d', '1', '/f',
    ], { stdio: 'ignore', timeout: 3000 })
  } catch {
    // 非致命
  }
  return () => {
    try {
      // DSH 退出时恢复原值
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
    } catch {
      // 非致命
    }
  }
})
```

---

## 重建

修改源码后需重新编译 `lib/` 才能生效：

```sh
pnpm run build:lib
# 或只编译改过的包
pnpm --filter @deepseek-ai/dsh-sandbox-windows-acl run build
pnpm --filter @deepseek-ai/dsh-sandbox-policy run build
```

然后**重启 DSH**。

---

## 相关提交

```
214ee4f8bf feat: add 4 glassmorphism themes (void/jade/solar/glacial) + glass-effect docs
```

> 注：该 commit 同时包含了 ui-theme 的预存修改（与我无关，是你工作区的既有改动）。
