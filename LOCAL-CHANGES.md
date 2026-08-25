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

## 重建

```sh
pnpm run build:lib
```

然后**重启 DSH**。

---

## 相关提交

```
214ee4f8bf feat: add 4 glassmorphism themes + crash-dialog fix
```
