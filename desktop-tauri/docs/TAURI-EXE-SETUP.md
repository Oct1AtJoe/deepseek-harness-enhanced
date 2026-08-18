# Tauri 桌面端问题排查

## 问题:双击 exe 后等待超时(60 秒)

### 现象

双击 `DeepSeekHarness.exe`,显示错误页"等待本地服务就绪超时(60 秒)";日志

```
%LOCALAPPDATA%\ai.deepseek.harness.desktop\logs\dsh-desktop.log
```

中可见两种模式:

1. `启动 dsh 失败:未找到 @deepseek-ai/dsh` —— exe 找不到全局包;
2. `dsh 子进程已启动(PID xxx)` 但随后崩溃、超时 —— 全局包装载成功但引导失败。

### 根本原因

exe 的自动启动流程(`lib.rs setup`):

```
端口空闲 → node <bin.js> web --host 127.0.0.1 --port 3080 → 等待就绪 → 导航
```

`bin.js` 的来源取决于优先级:`DSH_BIN`(仓库构建)> `%APPDATA%\npm\...`(全局包)>

多级 nvm / PATH 兜底。

崩溃场景:全局 `@deepseek-ai/dsh` 0.1.0-rc.6 的 skill 服务缺少 `setInvocationOverride`

API,而 `~/.dsh/profiles/web` 挂载了仓库的 `skill-manager` 插件(调用此 API)。仓库 CLI

自洽(已验证 `packages/skill/skill/lib/index.js:281` 含此 API),但全局发布版不含。

## 修复:设置 DSH_BIN

让 exe 直接使用仓库构建的 CLI,绕过全局包版本不匹配。

### 设置

```powershell
# 用户级永久环境变量(写入注册表 HKCU:\Environment)
# 将 <repo> 替换为你的仓库绝对路径
[Environment]::SetEnvironmentVariable('DSH_BIN', '<repo>\apps\cli\lib\bin.js', 'User')
```

设置后**必须重启资源管理器**(任务管理器→Windows 资源管理器→重启)或注销重登,Explorer

缓存的环境变量才会更新。

### 验证

```powershell
# 确认变量已写入
[Environment]::GetEnvironmentVariable('DSH_BIN','User')
# → <repo>\apps\cli\lib\bin.js

# 确认仓库 lib 可用
Test-Path '<repo>\apps\cli\lib\bin.js'
# → True
```

### 冒烟测试

从 `desktop-tauri/` 目录(cwd 模拟双击)启动仓库 CLI:

```powershell
# 在仓库根目录执行
node apps/cli/lib/bin.js web --host 127.0.0.1 --port 3099
```

预期:数秒内输出 `ready`、HTTP 200、页面标题 `DeepSeek Harness`、无 stderr。
仓库 CLI 对 cwd 不敏感;从 `desktop-tauri/` 启动与从仓库根目录启动行为一致。

### 端到端验证(端口 3080 空闲时)

1. 停止 3080 上的现有服务;
2. 双击 `DeepSeekHarness.exe`;
3. 检查日志应出现 `dsh 子进程已启动(PID xxx)` + `本地服务就绪,已导航到 http://127.0.0.1:3080/`;

   不应出现超时报错。

> **注意**:当前 3080 跑的就是 DSH Web GUI 会话,停掉会中断进行中的对话;建议在会话结束后再测。

## 常见问题

### 日志仍报"未找到 @deepseek-ai/dsh"

`DSH_BIN` 未生效——Explorer 仍用旧环境变量。重启资源管理器后重试。验证:

```powershell
[Environment]::GetEnvironmentVariable('DSH_BIN','User')
```

### 日志报超时,无子进程崩溃信息

`node <bin.js> web` 本身启动失败。手动运行以定位错误:

```powershell
node "<repo>\apps\cli\lib\bin.js" web --host 127.0.0.1 --port 3099
```

常见原因:仓库未构建(`pnpm run build`)、`DEEPSEEK_API_KEY` 缺失(服务本身需要)。

### 修改 bin.js 后需要重新打包吗?

不需要。`DSH_BIN` 指向仓库 lib,重建 exe 不改变这个路径;每次 `pnpm run build` 后 lib

自动更新,exe 直接使用最新版本。

### 何时可以不设 DSH_BIN?

当全局包与仓库版本一致时。选项:

- 将仓库代码发布为新版本 npm 包(然后 `npm i -g @deepseek-ai/dsh@latest`);
- 或在仓库目录执行 `npm pack && npm i -g <tgz>` 本地打包安装;
- 目前 repo 是主开发分支,`DSH_BIN` 是最直接的桥梁。

## 诊断过程记录

| 阶段 | 事件 | 详情 |
|------|------|------|
| 1 | 未找到全局包 | `启动 dsh 失败:未找到 @deepseek-ai/dsh` —— 全局包未安装 |
| 2 | 全局包找到但崩溃 | spawn 成功,子进程 4 秒后报 `ctx.skills.setInvocationOverride is not a function` |
| 3 | 超时 | 端口 3080 未打开,等待 60 秒后跳错误页 |
| 4 | 设置 DSH_BIN | 指向 `<repo>/apps/cli/lib/bin.js`,绕过全局包 |
| 5 | 冒烟测试 | `node lib/bin.js web --port 3099`,数秒就绪,HTTP 200 |

## 相关环境变量速查

| 变量 | 含义 |
|------|------|
| `DSH_BIN` | exe spawn 用的 bin.js 路径(仓库构建) |
| `DSH_DESKTOP_PORT` | 探测/拉起服务端口(默认 3080) |
| `DSH_DESKTOP_BACKEND` | 完整启动命令覆盖(JSON argv) |
| `DSH_HOME` | dsh 配置目录(默认 `~/.dsh`) |
