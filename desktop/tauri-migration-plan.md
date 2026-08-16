# dsh-desktop Tauri 2 迁移方案

> 状态：**已落地**（`desktop-tauri/`，Windows-only，2026-08-16 单元测试 4/4 + A/B/C 验收三路径全绿）。
> 本文档与落地实现对照；落地时的默认决策见文末「评审待定点」的结论。

## 1. 背景与目标

现状：`desktop/` 是一个独立于 pnpm workspace 的 Electron 壳（约 272 行 `main.mjs`），已实现：

- 探测 `http://127.0.0.1:3080`（或 `DSH_DESKTOP_PORT`）是否已有 dsh 服务，有则直接挂载。
- 否则拉起 `dsh web --port 0`，解析其 stdout 打印的 `dsh web: <url>`，加载该 URL。
- 退出应用时杀掉拉起的后端（Windows 上 `taskkill /T /F` 整树杀）。
- 单实例锁；`--smoke` 无头冒烟；外链/新窗口交系统浏览器；渲染层零 Node 权限（`nodeIntegration` 关、`contextIsolation` 开、sandbox）。

迁移动机（已与用户确认）：安装包和内存更小；获得托盘、通知、开机自启等原生能力；目标平台仅 Windows。

非目标：不重写后端（Cordis/TS 全插件体系保持原样，Rust 只做窗口壳与进程管理）；不做 macOS/Linux 首发（架构留扩展位，兼容性另行评估）。

## 2. 总体架构

与 Electron 版同构：Tauri（Rust）壳 + 外部 Node 进程跑 `dsh web` + WebView2 加载 localhost URL。渲染层仍是普通网页，不引入 preload、不做业务 IPC。

```
┌────────────────────────────┐
│ Tauri 壳 (Rust)             │
│  窗口 / 托盘 / 通知 / 自启   │
│  进程管理 (spawn/kill 后端)  │
└────────────┬───────────────┘
             │ stdout 解析 URL
┌────────────▼───────────────┐
│ WebView2 加载 http://127.0.0.1:<port> │
└────────────────────────────┘
┌────────────────────────────┐
│ 后端: node ... dsh web --port 0 │
└────────────────────────────┘
```

## 3. 技术选型

- Tauri 2.x，Rust stable 工具链（CI 与本地一致）。
- 插件清单：

| 插件 | 用途 | 对应现状 |
| --- | --- | --- |
| `tauri-plugin-shell` | 拉起后端进程、退出时杀进程树 | `spawn` / `taskkill` |
| `tauri-plugin-single-instance` | 单实例锁 + 二次启动聚焦窗口 | `requestSingleInstanceLock` |
| `tauri-plugin-opener` | 外链与新窗口交系统浏览器 | `shell.openExternal` |
| `tauri-plugin-autostart` | 开机自启开关（Windows 注册表 Run 键） | 无（新增） |
| `tauri-plugin-notification` | 通知 | 无（新增） |
| 内置 tray API | 托盘图标与菜单（退出/显示主窗口） | 无（新增） |

- 渲染安全默认值保持 Electron 版同等或更严：无 preload、无自定义协议、CSP 沿用 `dsh web` 自身的配置。

## 4. 后端进程管理（核心逻辑，逐条对齐 main.mjs）

启动序列：

1. `DSH_DESKTOP_URL` 已设置：直接加载该 URL，不探测、不拉起。
2. 探测 `http://127.0.0.1:${DSH_DESKTOP_PORT ?? 3080}`，响应 HTML 含 `__DSH_BOOT__` 则视为已有 dsh 服务，直接挂载。
3. 否则拉起后端：`dsh web --port 0`，从 stdout 匹配 `/dsh web: (https?:\/\/[^\s]+)/`，120 秒超时。
4. 后端中途退出（非应用主动杀）→ 视为致命错误，弹错误框并退出。
5. 应用退出（窗口全关 / 托盘退出）→ 杀掉拉起的后端；Windows 用 `taskkill /pid <pid> /T /F` 整树杀，覆盖 `dsh web` 可能拥有的子进程。

环境变量透传：`DSH_HOME`、`DEEPSEEK_API_KEY` 等原样继承（Tauri 子进程默认继承环境，无需额外处理）。

配置覆盖：保留 `DSH_DESKTOP_PORT`、`DSH_DESKTOP_BACKEND`（JSON argv 数组或空格分隔字符串）两个覆盖变量，行为与现状一致。

dev 模式差异：Electron 版用 `ELECTRON_RUN_AS_NODE` 让 CLI 跑在 Electron 自带 Node 上；Tauri 无此等价物，dev 模式改为调用系统 `node`（`node --import tsx/esm apps/cli/src/bin.ts web --port 0`）。README 已要求 `node` 在 PATH，影响有限。

packaged 模式：与现状一致，从 PATH 找 `dsh`；找不到时给出清晰错误提示（现状是 spawn error 后弹框，保留该行为）。内置运行时列为后续立项（见 §8）。

## 5. 窗口与导航

- 主窗口 1440x900，最小 900x600，`show: false`，页面 ready 后再显示（与现状一致）。
- 初始加载：后端 URL 未知，先加载内置本地 loading 页（打包进资源），后端就绪后 `webview.navigate(url)` 切换。
- 导航拦截：非当前 origin 的 http(s) 导航与 `target=_blank` 新窗口一律交系统浏览器（`tauri-plugin-opener`），等价现状的 `setWindowOpenHandler` + `will-navigate`。
- 加载失败：页面加载错误事件 → 错误对话框 + 退出，等价现状 `did-fail-load`。

## 6. 冒烟测试

移植 `--smoke`：argv 或环境变量触发，窗口不显示；监听页面加载完成事件；成功打印 `DSH_DESKTOP_SMOKE_OK` 并以 0 退出，失败打印 `DSH_DESKTOP_SMOKE_FAIL: <原因>` 并以 1 退出；整体超时兜底。

覆盖路径（与现状 README 对齐）：

- 挂载已有服务（`DSH_DESKTOP_URL` 或 3080 探测命中）。
- 拉起后端全流程（`DSH_HOME` 指向全新目录隔离实例）。
- 后端超时 / 启动失败 / 页面加载失败三条失败路径。

脚本：`npm run smoke`（先 `cargo build` 再跑产物，或 `cargo run -- --smoke`），行为与现状脚本等价。

## 7. 打包与分发（Windows）

- `tauri.conf.json`：identifier `ai.deepseek.harness.desktop`，productName `DeepSeek Harness`，bundle 目标 NSIS（x64）。
- 图标：仓库目前无品牌图标（Electron 版用默认图标，README 已承认）。需要一张 1024px PNG，`tauri icon` 生成全套（含 .ico、托盘图标、安装器图标）。图标来源是评审项。
- 代码签名：Windows 代码签名证书；CI 中签名，未签名安装包会有 SmartScreen 警告。
- WebView2：Win10 1903+ 基本预装；老系统在 NSIS 中附带 WebView2 bootstrapper（评审项：是否需要兼容老系统）。
- 通知 AUMID：Windows toast 通知要求开始菜单快捷方式带 AUMID，否则静默失败；需验证 tauri-bundler 的 NSIS 安装器是否自动创建带 AUMID 的快捷方式（验证项）。
- CI：Windows runner 安装 Rust stable 工具链，构建 Tauri 产物并上传 artifact；冒烟在 CI 无头执行。

## 8. 后续可选立项（本次不做）

内置 dsh 运行时：把 Node 运行时（或 Node SEA 单文件）作为 Tauri sidecar 打进安装包，去掉"机器上必须先装 dsh"的前置条件。这是分发体验的关键升级，但与换壳相互独立，优先级上换壳先行、此项单独立项。

## 9. 风险与验证项清单

| 项 | 风险/验证 | 结论 |
| --- | --- | --- |
| WebView2 兼容 | WebView2 即 Chromium，预期低风险；仍需真机跑一遍 GUI 全功能（GenUI 交互、剪贴板、下载、复制粘贴） | 冒烟矩阵覆盖 |
| 通知 AUMID | toast 需要带 AUMID 的快捷方式，可能静默失败 | 真机验证 |
| 单实例 | WebView2 进程模型无额外坑 | 验证 |
| 托盘图标 | 需要 .ico 资源，`tauri icon` 生成 | 随图标一并解决 |
| 后端 URL 解析 | 解析逻辑与现状一致，120s 超时 | 冒烟覆盖 |
| dev 模式 | 从 Electron 自带 Node 改为系统 node | 文档化，README 已要求 node 在 PATH |

## 10. 决策记录

- 为什么换掉 Electron：用户目标是体积/内存/原生能力，与 Electron 的短板（自带 Chromium、壳无托盘自启）直接对应；Electron 43 仍在维护，无被动迁移压力，但仓库处于预发布阶段，允许主动换基础。
- 为什么不是重写后端：后端是 Cordis 全插件体系，Rust 重写不现实也无必要。
- 为什么本次不内置运行时：独立问题、独立工作量，避免一次改动两个面。

## 11. 工作量估算（单人）

- 壳移植（进程管理 + 窗口 + 导航拦截）：1-2 天
- 冒烟移植 + 打包 + 图标 + 签名配置：1-2 天
- CI 与真机验证矩阵：约 1 天
- 合计约一周；不占 pnpm workspace 门禁（独立目录，同 Electron 版策略）。

## 12. 验收标准

- [ ] dev 模式一键拉起后端并显示 GUI（等价 `npm start`）
- [ ] 已有 3080 服务时直接挂载、不拉起新后端
- [ ] 退出应用后拉起的后端被整树杀死
- [ ] 外链与 `target=_blank` 走系统浏览器
- [ ] 二次启动聚焦已有窗口（单实例）
- [ ] `--smoke` 四条路径全部通过且退出码正确
- [ ] NSIS 安装后可运行；无 `dsh` 在 PATH 时报清晰错误
- [ ] 托盘图标可显示、托盘退出正常
- [ ] 开机自启开关生效
- [ ] 通知冒烟通过（含 AUMID 验证）

## 评审待定点（落地结论，2026-08-16）

1. **目录策略**：已按方案默认执行——新建 `desktop-tauri/` 并存，Electron 版保留；A/B/C 验收通过后择机替换。
2. **品牌图标**：已用用户提供的 DeepSeek 鲸鱼图标（512x512 PNG，`desktop-tauri/src-tauri/icons/source.png`），`tauri icon` 生成全套（任务栏/托盘/安装包共用）；原始附件备份在 `~/.dsh/attachments/`。若后续要透明底版本需抠图处理。
3. **WebView2 bootstrapper**：未附带（Win10 1903+ 预装）；如需兼容老系统再在 NSIS 加 bootstrapper。
4. **通知 AUMID**：未做专门验证，列为真机验证项；失败则首版保留通知桥（Dock 角标/失焦逻辑），砍系统 toast 展示。
5. **内置运行时**：未立项（保持"机器需装 node + dsh"）；独立立项时参考 §8。

落地时新增/变更（相对本文档）：托盘增加开机自启开关（`tauri-plugin-autostart`）；`DSH_DESKTOP_AUTO_QUIT` 支持数值秒数（冷启动验收用 25s）；`DSH_DESKTOP_BACKEND` 支持 JSON argv（dev 场景跑仓库源码 CLI）；单测 4 个（version_key/parse_command/random_token）。
