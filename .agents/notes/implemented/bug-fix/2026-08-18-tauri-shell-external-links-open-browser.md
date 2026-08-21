# Agent Note: Tauri shell external links never reach the system browser

Status: implemented

English | [中文](2026-08-18-tauri-shell-external-links-open-browser.zh.md)

## Problem

In the Tauri desktop shell (`desktop-tauri/`), clicking a web link in the GUI does not open the system default browser. Two paths were both broken, unlike the Electron shell (`desktop/main.mjs`) which handles them:

1. `target="_blank"` links (the markdown renderer emits `rel="noopener noreferrer" target="_blank"`) raise WebView2 `NewWindowRequested`. wry forwards it to Tauri's new-window handler, but with no handler registered wry sets `SetHandled(true)` — the request is silently swallowed, nothing happens.
2. A plain link without `target` navigates the main webview frame away from `http://127.0.0.1:<port>` — the shell window leaves the GUI and loads the external page instead of handing it to the browser.

## Decision

Mirror the Electron shell semantics with Tauri's `WebviewWindowBuilder` handlers in `src-tauri/src/lib.rs`:

- `on_navigation(|url| bool)` — allow the app origin (`http://127.0.0.1:<port>`) and the Tauri app protocol (presented as `http://tauri.localhost` on Windows); any other `http`/`https` navigation is handed to the system browser and cancelled; non-http(s) schemes stay allowed.
- `on_new_window(|url, _| NewWindowResponse::Deny)` — every new-window request (window.open / target=_blank) with an http(s) URL is handed to the system browser, and the window is denied.

The browser-open call uses `ShellExecuteW` from the already-listed `windows` crate (one new feature `Win32_UI_WindowsAndMessaging`), not a new dependency. Deliberately not `cmd /c start`: cmd expands `%VAR%` and splits on `&`, corrupting common URLs.

## Alternatives considered

### tauri-plugin-opener (crate already in cargo cache)

**Why not:** Full plugin for a free-function need; pulls in `open` crate and plugin registration. The `windows` crate is already a dependency — one feature flag is the smaller diff. Revisit if the page ever needs to invoke the opener from JS over IPC (capabilities would then matter).

### `cmd /c start "" <url>` with CREATE_NO_WINDOW

**Why not:** `%VAR%` expansion corrupts URLs containing percent-encoding (`%20`, CJK), and `&` needs quoting discipline. `ShellExecuteW` hands the exact string to the shell.

## Consequences

- **Benefit:** Behavior parity with the Electron shell; no new crates; the shell can never display a page outside the app origin.
- **Cost:** The new-window handler denies non-http(s) new-window requests without opening them (e.g. `mailto:` in `window.open` stays blocked) — same as the Electron shell's `setWindowOpenHandler` which only opens http(s).
- **When to revisit:** If a product feature needs `window.open` of an in-app window, the handler would return `NewWindowResponse::Create` for that URL instead of `Deny`.

## Testing

| Test | Result |
|------|--------|
| `cargo test` (8 tests, incl. new `is_app_origin_matches_app_only`) | Pass |
| E2E: debug exe attached to a local test page (port 3999) that auto-clicks a `target="_blank"` link to `https://example.com/?t=blank` at 2s and navigates to `https://example.com/?t=navigate` at 6s | Both URLs logged as "外部链接已交由系统默认浏览器打开" (ShellExecuteW success); window title stayed `DeepSeek Harness` (navigation cancelled, no new window); app-origin navigation and the Tauri app protocol (`http://tauri.localhost`) allowed, no spurious browser opens |

E2E ran with a temporary `ai.deepseek.harness.desktop.dev` identifier to bypass the single-instance mutex while the user's release shell was running; identifier reverted afterwards.
