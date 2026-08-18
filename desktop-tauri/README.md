# dsh-desktop-tauri

DeepSeek Harness 桌面端：Tauri 2（Rust + WebView2）壳，Windows 平台。
与 `desktop/`（Electron 版）行为对齐，独立于 pnpm workspace（同 Electron 版策略，
Tauri 全家桶不进仓库安装与门禁）。

## 工作原理

1. 探测 `127.0.0.1:3080`（`DSH_DESKTOP_PORT` 可覆盖）——已有 dsh 服务则直接挂载，
   退出时不杀；
2. 端口空闲则拉起 `dsh web --host 127.0.0.1 --port <port>`：默认 `node <bin.js>`
   直跑（`dsh.cmd` shim 有引号转义坑），带多级兜底探测
   （`DSH_NODE` / `DSH_BIN` / PATH / nvm-windows / Program Files）；
3. 轮询服务就绪（500ms 间隔，60s 超时）后从加载页导航到 Web GUI；
4. 托盘常驻：关闭窗口仅隐藏（首次有通知提示），左键唤起，菜单可切换开机自启与退出；
5. 任务完成通知：窗口初始化脚本（`initialization_script`，文档解析前注入、跨导航持久）先注入
   通知桥 `window.__dshNotifyBridge`（`port`/`token`/`fire(payload)`，4s 节流去重）与
   Web Notification shim（WebView2 无浏览器通知权限：permission 恒报 granted，构造器
   `new Notification(...)` 直接触发桥——原版 dsh-notification 插件零改动可用），
   导航后再注入 `data-state="ongoing"` 忙碌→空闲轮询，经本地 HTTP 桥
   （随机端口 + Bearer token，含 CORS 预检应答）上报，窗口失焦/隐藏时才弹系统通知；
   桥请求体支持 `title` 与 `force`（`force: true` 时无条件弹）；
   插件把 `sessionId` 透传进桥请求体时，toast 挂点击回调：点击后聚焦窗口，并向页面派发
   `dsh:open-session` CustomEvent（`detail.sessionId`），由 dsh-notification-custom 插件的
   浏览器半监听并调用 `ctx.sessions.open` 跳转到对应会话；无 `sessionId` 时点击仅聚焦窗口；
6. 退出只回收本次启动的 dsh 子进程，复用的已有实例不受影响。

## 运行

前置：仓库已构建（`pnpm run build`，保证 `apps/web/dist` 存在），Rust 工具链
（stable-msvc）+ MSVC Build Tools，`pnpm` 在 PATH。

```sh
cd desktop-tauri
pnpm install
pnpm dev        # 开发模式（tauri dev，debug 构建）
pnpm build      # release 构建 + NSIS 安装包（产物在 src-tauri/target/release/）
```

## 环境变量

| 变量 | 含义 |
| --- | --- |
| `DSH_DESKTOP_URL` | *(未实现)* 直接加载该 URL。 |
| `DSH_DESKTOP_PORT` | 探测/拉起服务用的端口（默认 `3080`）。 |
| `DSH_DESKTOP_BACKEND` | 后端命令覆盖：JSON argv 数组或空格分隔字符串，追加 `web --host 127.0.0.1 --port <port>`。dev 场景示例：`["node","--import","tsx/esm","apps/cli/src/bin.ts"]`（cwd 需为仓库根）。 |
| `DSH_NODE` / `DSH_BIN` | 显式指定 node.exe / dsh 可执行文件（默认多级兜底探测）。 |
| `DSH_DESKTOP_AUTO_QUIT` | 测试钩子：`1` 时启动 8 秒后自动走退出流程（验收用）。 |
| `DSH_DESKTOP_NOTIFY_TEST` | 测试钩子：`1` 时启动 6 秒后触发一次测试通知。 |

`DSH_HOME`、`DEEPSEEK_API_KEY` 等 dsh 环境变量原样传给后端。

## 验收

```powershell
# 先退出所有 dsh-desktop 实例；A 路径要求 3080 已有 dsh 服务
powershell -ExecutionPolicy Bypass -File scripts\acceptance.ps1
```

A/B/C 三路径：复用已有服务 / 拉起+回收子进程（验端口释放）/ 受限 PATH 下 BACKEND 覆盖。

## 日志

stdout + `%LOCALAPPDATA%\ai.deepseek.harness.desktop\logs\dsh-desktop.log`。
PowerShell 5.1 读 UTF-8 日志用 `[IO.File]::ReadAllText($path,[Text.Encoding]::UTF8)`。

## 已知限制

- 打包应用不内置 dsh 运行时：机器上需要已装 Node.js 与 `@deepseek-ai/dsh`
  （`npm i -g @deepseek-ai/dsh`），或用 `DSH_DESKTOP_BACKEND` 指定。内置运行时是后续立项。
- 任务完成通知是 DOM 启发式（`data-state` 忙碌标记），分不清成功/失败/被停；
  权威信号（`turn/end` 事件）的语义化升级未做。
- Windows toast 通知依赖开始菜单快捷方式带 AUMID，未签名分发会触发 SmartScreen。
- 图标：DeepSeek 鲸鱼图标（用户提供，512x512 PNG），`pnpm tauri icon` 生成全套（任务栏/托盘/安装包共用）。
- **换图标坑**：`tauri icon` 重新生成 `icons/` 后，cargo 增量判断不会触发资源重嵌入（tauri-build 的 rerun-if-changed 不覆盖 icons/），必须 `cargo clean -p dsh-desktop --release`（在 `src-tauri/` 下）再 `pnpm build`，否则 exe 仍是旧图标。
- 仅 Windows；macOS/Linux 未支持。

## 与 desktop/（Electron 版）的关系

并存验证阶段：行为对齐（探测/挂载/拉起/回收/环境变量），Tauri 版额外提供托盘、
开机自启、任务完成通知。验证通过后择机替换 Electron 版。
