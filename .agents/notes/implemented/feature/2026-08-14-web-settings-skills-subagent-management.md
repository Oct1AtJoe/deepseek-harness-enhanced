# Agent Note: Skills and subagent management in the web settings page

Status: implemented

English | [中文](2026-08-14-web-settings-skills-subagent-management.zh.md)

## Problem

The Plugins settings page exposed configuration cards (shell, agent loop, web search) and a read-only Loader inventory, but nothing let a user see what skills are installed and whether the model can invoke them, or what subagents exist across sessions and whether one is still running. Skills were only visible through the conversation's injected catalog and tool rows; subagents only through one session's own work view. The management facts existed — `ctx.skills` lists and loads every winning skill with its invocation policy, and the sessions snapshot already carries every parent's subagent catalog — but neither had a management surface.

## Decision

Two new browser tabs and one new Host Remote, all through existing seams; no shell changes.

**`dsh-host-skill-manager` publishes a management Remote.** `SkillManagerGateway` registers the `skillManager` service with three direct Remotes: `list` (the winning catalog with effective invocation policies), `get` (one full skill body), and `setInvocation` (force one skill's effective policy). Catalog reads are session-addressed: the client passes the currently selected session's id, and the gateway resolves the project cwd from the session header and the view scope from the live agent or the recorded preset's standing key — the same resolution the apiproxy's skills domain uses — before reading the layered registry. This is load-bearing, not a convenience: the shipped web composition deliberately disables the host-plane skill provider so presets own local discovery, which means an unscoped host read returns an empty catalog while every session serves its own. The override is written through a new registry primitive, `SkillRegistry.setInvocationOverride(name, policy | undefined)`, which wins over every provider-declared policy at list and get projection, invalidates the catalog caches, and emits the existing `skills/change` event; a name with no catalog entry is accepted and applies once such a skill appears. Overrides persist under the `skill-overrides` user-settings namespace and are restored at gateway mount, so toggles survive restarts. A write applies to the registry before the settings document commits; a failed persistence leaves the live override in place.

**`dsh-client-ui-settings-skills` renders the Skills tab** (id `skills`, order 20): a searchable catalog where each card shows name, description, source, provider, and two invocation switches (model-invocable, user-invocable). A switch flip writes the complete next policy through `skillManager/setInvocation` and refreshes the catalog; failures surface in-row without losing the list. Expanding a card lazily loads the instruction body through `skillManager/get` with its own retry, plus the skill's file path when the provider has one. The tab addresses the catalog by the currently selected session from the standard sessions snapshot; without an open session it shows a hint and performs no Remote read.

**`dsh-client-ui-settings-subagents` renders the Subagents tab** (id `subagents`, order 30) with zero new RPC for listing: it flattens every parent's `subagentsByParent` catalog from the standard sessions snapshot into a cross-session roster ordered running-first, with mode tags, parent session ids, and an activity dot. Each healthy child offers Open (`sessions.openSubagent`); a running continuable child alone offers Stop, routed through the connection's `subagents.interrupt` under the durable parent-address authority — the same human-initiated interrupt the composer uses, with the same one-shot non-cancellability. The tab auto-pulls a catalog once for every parent the session summaries claim owns subagent children (tracked in a ref so re-renders do not re-pull), and a Refresh button re-pulls every known catalog.

Both tabs register into the existing `settings.plugins.tab` slot — the Plugins section owns the navigation entry and tab chrome — and both are lazy: no Remote read during plugin activation, no catalog fetch until the tab is first selected.

## Alternatives considered

- **A registry-level override filter instead of a registry primitive.** Declined: the override must affect the model-facing catalog itself (the `skill` tool and the injected catalog read `ctx.skills`), so filtering at the gateway would have made the toggles cosmetic.
- **Editing skill files to flip `disable-model-invocation` frontmatter.** Declined: provider-dependent, and it cannot represent a user override that contradicts the file.
- **A host Remote for subagent listing.** Declined: the sessions snapshot already carries every catalog; the tab reads it through the standard `useSessions` hook, and Stop reuses the existing `subagents.interrupt` wire. Only the Stop wrapper (error mapping) is new, closed over the connection handle in the plugin's `apply`.
- **A "clear override" Remote operation.** Declined for v1: the toggle writes the complete next policy, and an entry equal to the provider default is harmless; the settings document accumulates one entry per touched skill, recorded as a known limitation.

## Consequences

A user browses and searches the installed skills, reads any skill's instruction body, and switches model/user invocation per skill from the settings page; every switch persists across restarts and takes effect on the model-facing catalog immediately. A user sees every subagent across sessions with running state and mode, opens any child's transcript, and stops a running continuable child from the same page.

The registry gains one global override primitive whose scope is intentionally global — it has no per-preset variant, so a preset that wants a fixed policy still expresses it through its own composition. The two new tabs join the Plugins page's tab list, which changes the assembled settings snapshot (`apps/web/tests/snapshots/plugin-config/section.expected.md`) by two tab rows; the golden was re-recorded in the same change.

`dsh-skill`'s README and the new packages' READMEs document the override semantics and the known limitations (explicit-only overrides, global layer only, no external-edit watch; the subagents tab cannot cancel one-shot children and offers no history view).
