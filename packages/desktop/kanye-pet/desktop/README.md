# whale-girl-desktop

English | [中文](README.zh.md)

Renders the whale girl from [whale-girl](https://github.com/vlln/whale-girl)
(the DSH Web GUI desktop-pet plugin) onto the **operating system desktop**,
persistently: a transparent always-on-top window, draggable/feedable/playable,
periodic wander, following live DSH session state (thinking / waiting /
task-completion celebration).

**Zero runtime dependencies**: the Node engine has no third-party packages;
the desktop render shell uses Tauri (system webview, ~12MB, vs 277MB for
Electron).

## Install

```sh
npm i -g whale-girl-desktop          # or in-project: npm i whale-girl-desktop
# the desktop render shell needs the Rust toolchain (cargo):
cd "$(npm root -g)/whale-girl-desktop/src-tauri" && cargo build --release
```

## Usage

```sh
# windowless mode (presence heartbeat + state polling + SSE, self-test/CI/no-desktop environments)
whale-girl-desktop --headless

# desktop pet (transparent always-on-top window) — needs cargo build --release first
"$(npm root -g)/whale-girl-desktop/src-tauri/target/release/whale-girl-desktop"
# or from the source repo: cd desktop && npm run build:tauri && npm run start:tauri
```

Point at a non-local DSH: `WHALE_GIRL_BASE_URL=http://IP:PORT` (default
`http://127.0.0.1:3080`).

## Prerequisites

- DSH has the whale-girl plugin installed (`dsh plugin --profile web add
  "github:vlln/whale-girl#main"`)
- Node ≥18; the desktop render needs cargo (the Rust toolchain)

## Behavior

- While it runs, the web pet hides automatically (presence contract) and
  restores on exit/crash (TTL 45s expiry)
- State transitions / click interactions / drag / walk match the plugin
  version; design and contract: [DESIGN.md](DESIGN.md),
  [BUILD-RUN.md](BUILD-RUN.md)

## License

MIT
