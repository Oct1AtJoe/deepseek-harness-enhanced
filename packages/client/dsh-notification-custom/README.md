# @deepseek-ai/dsh-notification-custom

English | [中文](README.zh.md)

Local fork of [omdsh-dev/dsh-notification](https://github.com/omdsh-dev/dsh-notification) (v0.1.2). Desktop notifications for the DeepSeek Harness web GUI: when a session finishes a turn, the browser shows a system notification, so you can switch away and still know when DSH is done. Per-outcome toggles and include/exclude keyword rules control exactly which completions notify.

No harness change is needed: the host contributes a session projection (a bounded summary of each session's last completed turn), and the client watches the session list's completion reminder and applies its own persisted preferences.

```
host:   notification projection (last turn's reason/text/tools)  --session/projection-->  browser
client: session list completion reminder (live, dedup) + persisted settings
        -> permission + current-session visibility gate
        -> new Notification("DSH finished", { body: title })
```

## Local patch (vs upstream)

- **Notification body uses the session title instead of the model reply text**: `src/client/runner.ts` returns `body: title ?? ''`. When the title is empty the empty-body fallback text is used.
- **Desktop shell integration**: the Tauri shell (`desktop-tauri/` in this repository) injects a WebView2 shim (`window.Notification` reports `permission: granted` and the constructor fires the shell's local HTTP notification bridge) so the unmodified browser-half code path emits a Windows toast. This fork additionally passes the session id through the notification options: clicking the toast focuses the window and the shell dispatches a `dsh:open-session` event this plugin listens for, opening that session in the GUI. See `desktop-tauri/README.md`.

## Mount

The package is a workspace plugin; the web profile's `cordis.patch.yml` mounts it by name:

```yaml
- insert:
    - id: dsh-notification-custom
      name: '@deepseek-ai/dsh-notification-custom'
```

The upstream marketplace install (`dsh-notification`) is removed from the profile `package.json`; this fork replaces it in place.

## Settings

| Setting | Default | Effect |
| --- | --- | --- |
| Enable notifications | on | Master switch; off stops every notification while keeping rules. |
| Notify on completed / error / aborted / blocked / token limit | completed + error on, rest off | Which turn-end reasons notify (the host projection reports the reason). |
| Keyword rules | none | Include/exclude filters matched against the session title, the turn's reply text, and its tool names. Include rules: at least one must match. Exclude rules: a match suppresses. Rules support literal or regex matching with an optional case-sensitive flag. |
| Require manual dismiss | off | The notification stays until dismissed. |
| Only notify when the task is out of view | on | Suppress a notification only when its session is currently in view. A completion still notifies while the page is hidden or while another session/workspace is open. Turn it off to notify even for the session being watched. Notifications for the same session replace each other. |

Preferences persist in the browser (localStorage). The section also grants permission and sends a test notification.

## Configuration

Host-side tunables live on the plugin row in `cordis.yml`:

```yaml
- id: dsh-notification-custom
  name: '@deepseek-ai/dsh-notification-custom'
  config:
    maxBodyChars: 400      # projection body budget; longer replies are ellipsized host-side
```

## Model Experience

| Aspect | Effect |
| --- | --- |
| Token cost | None — notifications are UI-only and never enter a request. |
| Tool calls | None — the model gets no new tool. |
| Session log | Unchanged — the projection reads the existing log and adds no events. |
| Prompt | Unchanged — no system-prompt section is registered. |

## Permission boundary

- The host folds a pure projection over the session log (turn reason, bounded reply text, tool names) and the projection seam delivers it to the browser; the plugin writes nothing to the log and registers no model-facing tools.
- The client watches the session list's completion reminder (a live "finished while not selected" edge the runtime already computes) and shows a notification only when permission is available.
- Rule matching runs client-side against the projected content; the reply body never exceeds `maxBodyChars`.

## Development

```sh
pnpm --filter @deepseek-ai/dsh-notification-custom typecheck
pnpm run test:gui        # includes this package's vitest specs
pnpm --filter @deepseek-ai/dsh-notification-custom bundle
```

## Known Limitations and Deferred Work

- Notifications require the page to be open (they surface while the page is hidden, but not after the tab is closed). In the desktop shell they route through the shell's notification bridge and appear as Windows toasts.
- Notifications fire once per finished turn (a running→idle edge on any session); a completion that happened while the page was disconnected is not re-notified on reconnect.
- The rule subject is the session title plus the last turn's reply text and tool names — earlier turns are not matched.
- Notification body is a flat text snippet; clicking a notification focuses the window and, when a session id was attached, selects that session in the GUI (no deep link to the exact turn).

## License

MIT