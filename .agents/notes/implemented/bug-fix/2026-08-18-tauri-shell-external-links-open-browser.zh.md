# Agent Note: Tauri 壳内外部链接无法到达系统浏览器

Status: implemented

[English](2026-08-18-tauri-shell-external-links-open-browser.md) | 中文

## 问题

Tauri 桌面壳（`desktop-tauri/`）中，点击 GUI 里的网页链接不会打开系统默认浏览器。两条路径都是坏的，而 Electron 壳（`desktop/main.mjs`）能处理它们：

1. `target="_blank"` 链接（markdown 渲染器产出 `rel="noopener noreferrer" target="_blank"`）触发 WebView2 的 `NewWindowRequested`。wry 把它转给 Tauri 的新窗口处理器，但没有注册处理器时 wry 直接 `SetHandled(true)` —— 请求被静默吞掉，什么都不会发生。
2. 不带 `target` 的普通链接会把主 webview 帧从 `http://127.0.0.1:<port>` 导航走 —— 壳窗口离开 GUI，加载外部页面，而不是交给浏览器。

## 决策

在 `src-tauri/src/lib.rs` 中用 Tauri 的 `WebviewWindowBuilder` 处理器镜像 Electron 壳的语义：

- `on_navigation(|url| bool)` —— 放行应用 origin（`http://127.0.0.1:<port>`）与 Tauri 应用协议（Windows 上呈现为 `http://tauri.localhost`）；其余 `http`/`https` 导航交给系统浏览器并取消；非 http(s) 协议保持放行。
- `on_new_window(|url, _| NewWindowResponse::Deny)` —— 所有带 http(s) URL 的新窗口请求（window.open / target=_blank）交给系统浏览器，窗口请求被拒绝。

打开浏览器用已列依赖 `windows` crate 里的 `ShellExecuteW`（新增一个 feature `Win32_UI_WindowsAndMessaging`），不新增依赖。刻意不用 `cmd /c start`：cmd 会展开 `%VAR%` 并按 `&` 切分，破坏常见 URL。

## 备选方案

### tauri-plugin-opener（crate 已在 cargo 缓存）

**为什么不做：** 为一个自由函数需求引入完整插件；会拉入 `open` crate 与插件注册。`windows` crate 已是依赖 —— 一个 feature 标志是更小的 diff。若将来页面需要从 JS 经 IPC 调起 opener（那时 capabilities 才有意义）再重议。

### `cmd /c start "" <url>` + CREATE_NO_WINDOW

**为什么不做：** `%VAR%` 展开会破坏含百分号编码（`%20`、CJK）的 URL，且 `&` 需要引号纪律。`ShellExecuteW` 把原样字符串交给 shell。

## 后果

- **收益：** 与 Electron 壳行为对齐；无新 crate；壳永远不会显示应用 origin 之外的页面。
- **成本：** 新窗口处理器对非 http(s) 的新窗口请求只拒绝不打开（例如 `window.open` 里的 `mailto:` 仍被挡住）—— 与 Electron 壳的 `setWindowOpenHandler` 一致，后者也只打开 http(s)。
- **何时重议：** 若产品功能需要 `window.open` 打开应用内窗口，处理器可对该 URL 返回 `NewWindowResponse::Create` 而非 `Deny`。

## 测试

| 测试 | 结果 |
|------|--------|
| `cargo test`（8 个测试，含新增 `is_app_origin_matches_app_only`） | 通过 |
| E2E：debug exe 挂本地测试页（端口 3999），2s 自动点击指向 `https://example.com/?t=blank` 的 `target="_blank"` 链接、6s 导航到 `https://example.com/?t=navigate` | 两个 URL 均记录为「外部链接已交由系统默认浏览器打开」（ShellExecuteW 成功）；窗口标题保持 `DeepSeek Harness`（导航被取消、无新窗口）；应用 origin 导航与 Tauri 应用协议（`http://tauri.localhost`）放行，无误触浏览器 |

E2E 用临时 `ai.deepseek.harness.desktop.dev` 标识绕开单实例互斥（用户 release 壳当时在运行）；测试后已还原标识。
