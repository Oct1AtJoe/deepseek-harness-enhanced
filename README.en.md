# DeepSeek Harness Enhanced

English | [中文](README.md)

> **Local enhanced fork.** This checkout is official [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) master (snapshot `528c682e`, 2026-08-21) plus local customizations added incrementally since 2026-08-14. The feature checklist, replay steps, and merge-conflict guide live in [CUSTOM-FEATURES.md](CUSTOM-FEATURES.md). Remote: https://github.com/Oct1AtJoe/deepseek-harness-enhanced

DeepSeek Harness (`dsh`) is an open-source agent harness developed by [DeepSeek AI](https://deepseek.com).

It uses an architecture where **everything is a plugin**, and is powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper).

## Local enhancements

Custom features on top of official master (incremental, since 2026-08-14). Plugin-extracted features merge cleanly on upstream sync; the rest are small in-package changes replayed per [CUSTOM-FEATURES.md](CUSTOM-FEATURES.md):

- **Per-model effort memory** — switching models no longer resets the reasoning effort to the adapter default; new sessions inherit the remembered effort.
- **Failed-round re-run button** — a refresh action on a failed assistant reply re-sends the round's text (`@deepseek-ai/dsh-client-ui-resend-failed-round` plugin).
- **Image sending enabled** — the deepseek adapter no longer rejects image content.
- **Subagent tab + counter** — a subagent work view tab and a composer button with a live running-count badge.
- **Cross-workspace session reference** — `@`-triggered session candidates and injected referenced-session context (`ui-session-reference` plugin).
- **Produced-files diff stats** — file chips show `+N -M` and expand the round's changes (`@deepseek-ai/dsh-client-ui-deliverables-custom` fork).
- **aurora / nebula themes** — tech-style themes with glow, plus rounded pixel-style buttons.
- **Desktop shell** — an Electron wrapper (`desktop/`) and a Tauri 2 shell (`desktop-tauri/`) that spawn or attach to `dsh web`; WinRT notifications, external links open in system browser.
- **Increased LLM retry count** — default max retries raised from 2 to 10 (`DEFAULT_MAX_RETRIES`), improving recovery under high load or transient failures.
- **Desktop pet kanye-pet** — Tauri 2 desktop pet window with Kanye West character; notification bubbles for DSH session progress, click to focus the main window (`packages/desktop/kanye-pet/` + `ui-kanye-pet` settings card).
- **Session finish notifications** — browser system toast notifications when a session turn completes, per-outcome toggles, displays session title (`dsh-notification-custom` plugin).
- **Message navigation rail** — right-edge conversation navigation rail: one dash per user message, reading-position tracking, hover preview card, click-to-jump (`ui-msg-nav` plugin).
- **Subagent backend manager** — new "Subagents" tab in Web Settings: installed backend directory with install/remove/reconfigure (`host-subagent-manager` + `ui-settings-subagents`).
- **Skill manager** — new "Skills" tab in Web Settings: browse, inspect, and toggle invocation overrides (`host-skill-manager` + `ui-settings-skills`).
- **Nebula liquid-glass theme** — full glassmorphism: translucent surfaces with `backdrop-filter` blur, aurora background visible through panels; glassified buttons (drift animation + highlight border + glow).
- **pi-ai image placeholder** — text-only pi-ai models no longer reject images; renders `[image attachment ...]` placeholders consistent with the deepseek adapter.

### Syncing upstream

```powershell
powershell -File scripts/upstream-sync.ps1
git push origin master
```

The script downloads the official master tarball, commits it onto the `upstream-master` mirror line, and merges it into `master`. Conflicts are limited to the in-package customization points listed in CUSTOM-FEATURES.md.

## Developer preview

DeepSeek Harness is currently in _developer preview_ and is iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

## Run

### Run from `npm`

Install `Node.js`, then run:

```sh
npx @deepseek-ai/dsh web
```

The command starts the Web UI at `http://127.0.0.1:3080` by default and opens it in the default browser for a local launch. An SSH launch only prints the host URL because the SSH client or editor owns the local forwarded address. Pass `--no-open` to run the server without opening a browser. See [Web UI guide](docs/user/guide/index.md).

### Run from source

To run from a repository checkout:

```sh
git clone https://github.com/Oct1AtJoe/deepseek-harness-enhanced.git
cd deepseek-harness-enhanced
pnpm install
pnpm run build
pnpm dsh web
```

`pnpm run build` prepares the repository artifacts. `pnpm dsh web` uses those built artifacts without rebuilding.

## Community and support

- Feel free to submit feedback or bug reports through [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions).
- Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to your plugin repository for discoverability.
- Join <a href="https://discord.gg/Ycq5dCaS4">DeepSeek Harness Discord community</a>.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md).

For agents, follow [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
