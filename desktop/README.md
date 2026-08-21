# dsh-desktop

English | [中文](README.zh.md)

An Electron shell that wraps the DeepSeek Harness web app (`dsh web`) as a
desktop application. It is a standalone package (outside the pnpm workspace)
so its heavy Electron dependencies stay out of the repository install and
gates.

## Running

```sh
cd desktop
npm install
npm start
```

Prerequisites: the repository is built (`pnpm run build`, so `apps/web/dist`
exists) and `node` is on the PATH.

The backend is resolved in this order at startup:

1. `DSH_DESKTOP_URL` — load that address directly, no backend is launched.
2. `http://127.0.0.1:3080` (or `DSH_DESKTOP_PORT`) already serves dsh —
   attach to the existing server and share its sessions.
3. Otherwise launch `dsh web --port 0` (a system-assigned free port), parse
   and load the URL it prints; on exit the launched backend is killed (the
   whole process tree on Windows).

## Configuration

| Variable | Meaning |
| --- | --- |
| `DSH_DESKTOP_URL` | Load this URL directly, skipping probe and launch. |
| `DSH_DESKTOP_PORT` | Port probed for an existing service (default `3080`). |
| `DSH_DESKTOP_BACKEND` | Backend command override: a JSON argv array or a space-separated string. |
| `DSH_DESKTOP_NODE` | *(unused — in development the CLI runs on Electron's bundled Node)* |

dsh environment variables such as `DSH_HOME` and `DEEPSEEK_API_KEY` are passed
through to the backend as-is.

## Smoke test

`npm run smoke` loads the GUI headless (no window shown). On success it prints
`DSH_DESKTOP_SMOKE_OK` and exits 0; on failure it prints
`DSH_DESKTOP_SMOKE_FAIL: <reason>` and exits 1. When no server is running it
also covers the "launch a backend" path; point `DSH_HOME` at a fresh directory
to isolate the launched instance (the profile self-initializes on first use).

## Packaging

`npm run pack` builds installers with electron-builder (Windows NSIS / macOS
DMG / Linux AppImage). The packaged app does not embed a dsh runtime: it looks
for the `dsh` command on the PATH, so the machine running the packaged app
needs dsh installed (e.g. `npm i -g @deepseek-ai/dsh`) or must set
`DSH_DESKTOP_BACKEND`.

## Known limitations

- It is a browser window around a local service: standard Edit/View/Window
  menus only, no tray, auto-start, or other native capabilities.
- No branded icon yet; the Electron default icon is used.
