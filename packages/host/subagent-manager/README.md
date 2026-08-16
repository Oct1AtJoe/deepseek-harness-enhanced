# @deepseek-ai/dsh-host-subagent-manager

English | [中文](README.zh.md)

Management Remote over the subagent backend catalog and named subagent tools. `SubagentManagerGateway` registers the `subagentManager` service and publishes four generated direct Remotes: `subagentManager/list` (every subagent backend row of the Loader plus the installable optional backends — with provenance, effective config, and the live provider's capabilities — plus every named subagent tool row of `@deepseek-ai/dsh-tool-subagent` with its tool name, provider, child model, and background mode), `subagentManager/installBackend` (append an insert row for one optional backend), `subagentManager/removeBackend` (disable one backend or tool row), and `subagentManager/updateConfig` (replace one backend or tool row's whole config). The catalog covers the built-in in-process providers (spawn, fork) and the optional external backends (acp, claude-code, codex, dsh-sdk); built-ins cannot be installed or removed.

Writes append entries to the harness-wide user patch layer (`~/.dsh/cordis.patch.yml`, via `dshHomePath`), which the boot watcher hot-reloads — a change takes effect without a restart. Provenance on `list` is derived by parsing that same patch file: a row id found there reports `source: 'user'`, anything else `source: 'bundle'`. `updateConfig` shallow-replaces the row's whole config, so callers send the complete next config; `installBackend` refuses built-ins and modules outside the catalog; `removeBackend` refuses unknown rows that are neither backends nor named tools.

The service is Remote-only and declares no same-process Cordis `Context` merge. Client packages consume it through the explicit [`api-remotes`](../../api/remotes/README.md) assembly rather than importing the Host implementation.

## Model Experience

None, as the package only reads the Loader and the provider registry and appends loader patch text; it performs no model-facing prompt, tool, message, or provider request of its own.

#### KV Cache effect

None; this package assembles no model input.

## Known Limitations and Deferred Work

- **Remove disables, it does not delete** — a removed row keeps its loader entry with `disabled: true`; there is no uninstall that drops the row from the patch file.
- **No re-enable** — `install` refuses a module whose row already exists, and there is no operation to clear a disable override, so a backend disabled through the Remote cannot be turned back on without editing the patch file by hand.
- **Patch file races** — concurrent writes from two sessions append without locking; the boot watcher applies the final file state.
