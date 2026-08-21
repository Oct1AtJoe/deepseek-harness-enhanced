# dsh-desktop-tauri

English | [中文](README.zh.md)

DeepSeek Harness desktop: a Tauri 2 (Rust + WebView2) shell, Windows
platform. Behavior-aligned with `desktop/` (the Electron version), and kept
outside the pnpm workspace (same policy as the Electron version: the Tauri
toolchain does not enter the repository install or gates).

## How it works

1. Probes `127.0.0.1:3080` (overridable via `DSH_DESKTOP_PORT`) — if a dsh
   service is already running, attach to it and do not kill it on exit;
2. If the port is free, launch `dsh web --host 127.0.0.1 --port <port>`:
   by default run `node <bin.js>` directly (the `dsh.cmd` shim has a
   quote-escaping pitfall), with a multi-level fallback probe (`DSH_NODE` /
   `DSH_BIN` / PATH / nvm-windows / Program Files);
3. Poll for service readiness (500ms interval, 60s timeout), then navigate
   from the loading page into the Web GUI;
4. Tray resident: closing the window only hides it (first time shows a notice);
   left-click restores it; the menu can toggle auto-start and quit;
5. Task-completion notifications: the window initialization script
   (`initialization_script`, injected before document parsing, persistent
   across navigation) first injects a notification bridge
   `window.__dshNotifyBridge` (`port`/`token`/`fire(payload)`, 4s
   throttled dedup) and a Web Notification shim (WebView2 has no browser
   notification permission: permission always reports granted, and the
   constructor `new Notification(...)` fires the bridge directly — the stock
   dsh-notification plugin works unmodified); after navigation it injects a
   `data-state="ongoing"` busy→idle poll, reported over a local HTTP bridge
   (random port + Bearer token, with CORS preflight handling), and the system
   notification fires only when the window is blurred/hidden; the bridge
   request body supports `title` and `force` (`force: true` fires
   unconditionally); when the plugin passes `sessionId` through to the bridge
   request body, the toast gets a click callback: clicking focuses the window
   and dispatches a `dsh:open-session` CustomEvent (`detail.sessionId`) to the
   page, which the dsh-notification-custom plugin's browser half listens for
   and calls `ctx.sessions.open` to jump to that session; without a
   `sessionId`, clicking only focuses the window;
6. External-link handling (behavior-aligned with the Electron version):
   `target=_blank`/`window.open` new-window requests and main-frame
   http(s) navigations to origins other than the app's
   (`http://127.0.0.1:<port>`) are always handed to the system default
   browser (`ShellExecuteW`, not parsed through cmd); no external pages are
   allowed to open inside the shell; the Tauri app protocol (on Windows
   `http://tauri.localhost`) is treated as in-app and allowed;
7. Quit reaps only the dsh child process launched this run; a reused existing
   instance is untouched.

## Running

Prerequisites: the repository is built (`pnpm run build`, so `apps/web/dist`
exists), the Rust toolchain (stable-msvc) + MSVC Build Tools, and `pnpm` on
the PATH.

```sh
cd desktop-tauri
pnpm install
pnpm dev        # development mode (tauri dev, debug build)
pnpm build      # release build + NSIS installer (artifacts in src-tauri/target/release/)
```

## Environment variables

| Variable | Meaning |
| --- | --- |
| `DSH_DESKTOP_URL` | *(not implemented)* load this URL directly. |
| `DSH_DESKTOP_PORT` | Port used to probe/launch the service (default `3080`). |
| `DSH_DESKTOP_BACKEND` | Backend command override: a JSON argv array or a space-separated string, appended with `web --host 127.0.0.1 --port <port>`. Dev-scenario example: `["node","--import","tsx/esm","apps/cli/src/bin.ts"]` (cwd must be the repo root). |
| `DSH_NODE` / `DSH_BIN` | Explicitly specify node.exe / the dsh executable (default multi-level fallback probe). |
| `DSH_DESKTOP_AUTO_QUIT` | Test hook: with `1`, run the quit flow automatically 8s after start (for acceptance). |
| `DSH_DESKTOP_NOTIFY_TEST` | Test hook: with `1`, fire one test notification 6s after start. |

dsh environment variables such as `DSH_HOME` and `DEEPSEEK_API_KEY` are
passed through to the backend as-is.

## Acceptance

```powershell
# first quit all dsh-desktop instances; the A path requires a dsh service already on 3080
powershell -ExecutionPolicy Bypass -File scripts\acceptance.ps1
```

Three A/B/C paths: reuse an existing service / launch + reap the child
process (verifies port release) / BACKEND override under a restricted PATH.

## Logging

stdout + `%LOCALAPPDATA%\ai.deepseek.harness.desktop\logs\dsh-desktop.log`.
To read UTF-8 logs in PowerShell 5.1, use
`[IO.File]::ReadAllText($path,[Text.Encoding]::UTF8)`.

## Known limitations

- The packaged app does not embed a dsh runtime: the machine needs Node.js
  and `@deepseek-ai/dsh` installed (`npm i -g @deepseek-ai/dsh`), or must set
  `DSH_DESKTOP_BACKEND`. An embedded runtime is a follow-up project.
- Task-completion notification is a DOM heuristic (the `data-state` busy
  marker) and cannot distinguish success/failure/stopped; a semantic upgrade
  to the authoritative signal (the `turn/end` event) is not done.
- Windows toast notifications depend on the Start-menu shortcut carrying an
  AUMID; an unsigned distribution triggers SmartScreen.
- Icon: the DeepSeek whale icon (user-provided, 512x512 PNG); `pnpm tauri
  icon` generates the full set (taskbar/tray/installer shared).
- **Icon-swap pitfall**: after `tauri icon` regenerates `icons/`, cargo's
  incremental check does not trigger a resource re-embed (tauri-build's
  rerun-if-changed does not cover icons/), so you must run `cargo clean -p
  dsh-desktop --release` (in `src-tauri/`) and then `pnpm build`, otherwise
  the exe still carries the old icon.
- Windows only; macOS/Linux not supported.

## Relationship to desktop/ (Electron version)

Coexistence verification phase: behavior-aligned (probe/attach/launch/reap/
environment variables), and the Tauri version additionally provides tray,
auto-start, and task-completion notifications. After verification passes,
replace the Electron version when the time comes.
