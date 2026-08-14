# dsh-desktop

An Electron shell that runs the DeepSeek Harness Web GUI (`dsh web`) as a
native desktop app. It is a standalone package (not a pnpm workspace member)
so the heavy Electron toolchain stays out of the repository's install and
gates.

## Run

```sh
cd desktop
npm install
npm start
```

Prerequisites: the repository must be built (`pnpm run build` from the repo
root, so `apps/web/dist` exists) and `node` must be on PATH.

When the app starts it resolves the backend in this order:

1. `DSH_DESKTOP_URL` — load that exact URL; nothing is spawned.
2. `http://127.0.0.1:3080` (or `DSH_DESKTOP_PORT`) already serving a dsh GUI —
   attach to the running server, sharing its sessions.
3. Otherwise spawn `dsh web --port 0`, parse the printed URL, and load it. The
   spawned backend is killed when the app quits (tree-wide on Windows).

## Configuration

| Variable | Meaning |
| --- | --- |
| `DSH_DESKTOP_URL` | Load this URL directly; skip probing and spawning. |
| `DSH_DESKTOP_PORT` | Port to probe for an existing server (default `3080`). |
| `DSH_DESKTOP_BACKEND` | Backend command override: a JSON argv array or a whitespace-separated string. |
| `DSH_DESKTOP_NODE` | *(unused — dev mode runs the CLI on Electron's own Node)* |

`DSH_HOME`, `DEEPSEEK_API_KEY`, and every other dsh environment variable pass
through to the backend unchanged.

## Smoke test

`npm run smoke` loads the GUI headless (window never shown) and exits 0 with
`DSH_DESKTOP_SMOKE_OK` on success, or 1 with `DSH_DESKTOP_SMOKE_FAIL: <reason>`
on failure. With no server running it also exercises the backend-spawn path;
point `DSH_HOME` at a fresh directory to keep the spawned instance isolated
(profiles auto-initialize on first use).

## Packaging

`npm run pack` builds installers with electron-builder (NSIS on Windows, DMG
on macOS, AppImage on Linux). The packaged app does not bundle the dsh
runtime: it spawns a `dsh` CLI from PATH, so the machine running the packaged
app needs `dsh` installed (e.g. `npm i -g @deepseek-ai/dsh`), or
`DSH_DESKTOP_BACKEND` must point at one.

## Known limitations

- The shell is a browser window around the local server — it does not add
  native menus beyond the standard Edit/View/Window roles, tray support, or
  auto-start.
- App icons are the default Electron icon until a brand icon is added.
