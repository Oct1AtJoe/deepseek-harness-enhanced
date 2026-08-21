# Agent Note: Tauri exe auto-spawn fails with global package + repo profile

Status: implemented

English | [中文](2026-08-16-tauri-exe-auto-spawn-version-mismatch.zh.md)

## Problem

Double-clicking the Tauri desktop exe (`DeepSeekHarness.exe`) when port 3080 is free fails with a 60-second timeout. The exe successfully locates and spawns the globally installed `@deepseek-ai/dsh` 0.1.0-rc.6, but the child process crashes 4 seconds into boot:

```
TypeError: ctx.skills.setInvocationOverride is not a function
  at ... packages/host/skill-manager/lib/index.js:122:74
```

The user's `~/.dsh/profiles/web` mounts the repo's `skill-manager` plugin (by absolute path), which calls `ctx.skills.setInvocationOverride` — an API present in the repo's built `packages/skill/skill/lib/index.js` but absent from the published npm package (0.1.0-rc.6). The global package's default host composition loads its own skill service, which lacks this method. The user's manual service (`node --import tsx/esm apps/cli/src/bin.ts web`) works because it resolves the skill service from repo source, where the API exists.

## Decision

Set a user-level `DSH_BIN` environment variable pointing to the repo's built CLI entry:

```
DSH_BIN = E:\vibeCoding\deepseek-harness-enhanced\apps\cli\lib\bin.js
```

The exe's `find_dsh_bin_js()` checks `DSH_BIN` first (returns immediately if `is_file()` passes), skipping the global package search. This makes the exe spawn the repo CLI, which loads the repo's built skill service — the same code path as the user's manual service.

Smoke test (port 3099, cwd = `desktop-tauri/` simulating double-click): ready in 3 seconds, HTTP 200, `<title>DeepSeek Harness</title>`, no stderr. The repo CLI is cwd-independent.

Fix persisted in `desktop-tauri/docs/TAURI-EXE-SETUP.md` (troubleshooting guide) and `desktop-tauri/README.md` (已知限制 updated).

## Alternatives considered

### Publish a new npm version from repo source

**Why not:** Requires full npm publish pipeline. The repo is under active development (pre-release); `DSH_BIN` bridges the gap with zero publish overhead. Revisit when the project reaches a release milestone.

### Set `DSH_DESKTOP_BACKEND` instead of `DSH_BIN`

**Why not:** `DSH_DESKTOP_BACKEND` accepts a JSON argv array and appends `web --host --port` automatically — semantically a full backend override. `DSH_BIN` is simpler (single file path, no JSON quoting in `setx`), and the exe's existing `find_node() + bin.js` invocation pattern matches exactly. Both work; `DSH_BIN` is the lighter touch.

### Install the repo as the global package (`npm i -g <repo-path>`)

**Why not:** The repo is a pnpm workspace; its root `package.json` is not the publishable `@deepseek-ai/dsh` package. Global-installing from the repo path is fragile (workspace resolution, devDeps, build artifacts). `DSH_BIN` avoids modifying the global npm state.

## Consequences

- **Cost:** The fix is machine-specific (user-level registry env var); other machines without `DSH_BIN` would hit the same crash if they use the same profile with the global package. The repo must stay built (`pnpm run build` producing `apps/cli/lib/bin.js`).
- **Benefit:** Zero changes to desktop-tauri source, no rebuild required, no npm publish dependency. The exe's auto-spawn path works identically to the user's manual service. The global package remains installed but is bypassed.
- **When to revisit:** When `@deepseek-ai/dsh` is published with matching API (or when the project ships a bundled runtime), `DSH_BIN` can be unset and the global package becomes self-sufficient again.

## Testing

| Test | Result |
|------|--------|
| `node apps/cli/lib/bin.js web --port 3099` from `desktop-tauri/` cwd | 3s ready, HTTP 200, GUI served |
| `[Environment]::GetEnvironmentVariable('DSH_BIN','User')` | Returns correct path |
| `Test-Path apps/cli/lib/bin.js` | True |
| Repo built `packages/skill/skill/lib/index.js` contains `setInvocationOverride` | Confirmed at line 281 |

End-to-end test (port 3080 free, exe double-click) requires stopping the current running DSH service (which hosts the active GUI session); deferred to post-session verification.
