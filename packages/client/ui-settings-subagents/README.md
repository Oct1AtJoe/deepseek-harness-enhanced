# @deepseek-ai/dsh-client-ui-settings-subagents

English | [中文](README.zh.md)

Subagents management tab for Web Plugins settings. The browser plugin registers one localized `settings.plugins.tab` contribution with id `subagents`; the Plugins section owns the navigation entry and tab chrome. The tab reads the standard sessions snapshot — zero RPC for listing: it flattens every parent's `subagentsByParent` catalog into a cross-session roster ordered running-first, with mode tags (continuable / one-shot), parent session ids, and an activity dot.

Each healthy child offers an Open action (`sessions.openSubagent`) and, for a running continuable child only, a Stop action routed through the connection's `subagents.interrupt` under the durable parent-address authority, matching the composer's own stop semantics; refusals surface per-row. The tab auto-pulls a catalog once for every parent the session summaries claim owns subagent children, and a Refresh button re-pulls every known catalog. Copy is bilingual (zh/en) and follows the active locale.

## Model Experience

None: this package renders a management surface and performs no model-facing prompt, tool, message, or provider request of its own. The Stop action is the same human-initiated interrupt the composer offers, whose durable effects are logged by the Host.

#### KV Cache effect

None; this package never assembles model input.

## Known Limitations and Deferred Work

- **No one-shot cancellation** — a running one-shot child cannot be interrupted by design; only continuable children expose Stop.
- **Roster is live-state only** — settled subagents stay listed while their parent sessions are known; no history view or transcript search is provided here (Open leads to the child's own conversation).
