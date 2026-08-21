# Agent Note: Tauri exe 自动拉起在「全局包 + 仓库 profile」组合下失败

Status: implemented

[English](2026-08-16-tauri-exe-auto-spawn-version-mismatch.md) | 中文

## 问题

在 3080 端口空闲时双击 Tauri 桌面 exe（`DeepSeekHarness.exe`）会以 60 秒超时报错。exe 能成功定位并拉起全局安装的 `@deepseek-ai/dsh` 0.1.0-rc.6，但子进程在启动 4 秒后崩溃：

```
TypeError: ctx.skills.setInvocationOverride is not a function
  at ... packages/host/skill-manager/lib/index.js:122:74
```

用户的 `~/.dsh/profiles/web` 以绝对路径挂载了仓库的 `skill-manager` 插件，它调用 `ctx.skills.setInvocationOverride` —— 该 API 存在于仓库构建的 `packages/skill/skill/lib/index.js`，但发布到 npm 的包（0.1.0-rc.6）中没有。全局包的默认宿主组合加载它自己的 skill 服务，该服务没有这个方法。用户的手工服务（`node --import tsx/esm apps/cli/src/bin.ts web`）之所以正常，是因为它从仓库源码解析 skill 服务，那里 API 存在。

## 决策

设置用户级 `DSH_BIN` 环境变量，指向仓库构建出的 CLI 入口：

```
DSH_BIN = E:\vibeCoding\deepseek-harness-enhanced\apps\cli\lib\bin.js
```

exe 的 `find_dsh_bin_js()` 首先检查 `DSH_BIN`（`is_file()` 通过则直接返回），跳过全局包搜索。这样 exe 拉起的是仓库 CLI，加载仓库构建的 skill 服务 —— 与用户手工服务同一代码路径。

冒烟测试（端口 3099，cwd = `desktop-tauri/` 模拟双击）：3 秒 ready，HTTP 200，`<title>DeepSeek Harness</title>`，无 stderr。仓库 CLI 不依赖 cwd。

修复已固化到 `desktop-tauri/docs/TAURI-EXE-SETUP.md`（故障排查指南）与 `desktop-tauri/README.md`（已知限制已更新）。

## 备选方案

### 从仓库源码发布新的 npm 版本

**为什么不做：** 需要完整的 npm 发布流水线。仓库处于活跃开发（pre-release）阶段；`DSH_BIN` 以零发布开销弥合差距。等项目到达发布里程碑再重议。

### 用 `DSH_DESKTOP_BACKEND` 代替 `DSH_BIN`

**为什么不做：** `DSH_DESKTOP_BACKEND` 接受 JSON argv 数组并自动追加 `web --host --port` —— 语义上是完整后端覆盖。`DSH_BIN` 更简单（单一文件路径，`setx` 里无需 JSON 引号），且 exe 现有的 `find_node() + bin.js` 调用模式与它完全吻合。两者都可行；`DSH_BIN` 改动更轻。

### 把仓库安装为全局包（`npm i -g <repo-path>`）

**为什么不做：** 仓库是 pnpm workspace；其根 `package.json` 不是可发布的 `@deepseek-ai/dsh` 包。从仓库路径全局安装很脆弱（workspace 解析、devDeps、构建产物）。`DSH_BIN` 避免改动全局 npm 状态。

## 后果

- **成本：** 修复是机器特定的（用户级注册表环境变量）；没有 `DSH_BIN` 的机器若用同样的 profile + 全局包会撞上同样的崩溃。仓库必须保持构建状态（`pnpm run build` 产出 `apps/cli/lib/bin.js`）。
- **收益：** 零改动 desktop-tauri 源码，无需重编译，无 npm 发布依赖。exe 的自动拉起路径与用户手工服务行为一致。全局包保持安装但被绕过。
- **何时重议：** 当 `@deepseek-ai/dsh` 以匹配 API 发布（或项目内建运行时）时，可 unset `DSH_BIN`，全局包恢复自足。

## 测试

| 测试 | 结果 |
|------|--------|
| 从 `desktop-tauri/` cwd 运行 `node apps/cli/lib/bin.js web --port 3099` | 3s ready，HTTP 200，GUI 正常 |
| `[Environment]::GetEnvironmentVariable('DSH_BIN','User')` | 返回正确路径 |
| `Test-Path apps/cli/lib/bin.js` | True |
| 仓库构建的 `packages/skill/skill/lib/index.js` 含 `setInvocationOverride` | 确认在第 281 行 |

端到端测试（3080 空闲、双击 exe）需要停掉当前运行中的 DSH 服务（它承载活跃的 GUI 会话）；推迟到会话结束后验证。
