# @deepseek-ai/dsh-host-skill-manager

English | [中文](README.zh.md)

Management Remote over the skill registry. `SkillManagerGateway` registers the `skillManager` service and publishes three generated direct Remotes: `skillManager/list` (the winning catalog with effective invocation policies), `skillManager/get` (one full skill body), and `skillManager/setInvocation` (force one skill's effective invocation policy and persist it). Catalog reads are session-addressed: `list` and `get` take the viewing session's id, resolve its project cwd from the session header and its view scope from the live agent or the recorded preset's standing key (the same resolution the apiproxy's skills domain uses), and read `ctx.skills` through that scope — so the page shows exactly the catalog the session's model-facing composition serves. In the shipped web composition the host plane mounts no skill provider; presets own local discovery, which is why the session address is load-bearing rather than a convenience.

`setInvocation` writes through the registry's global invocation override, which wins over every provider-declared policy at list and load projection. The override is persisted under the `skill-overrides` user-settings namespace and restored at plugin mount, so toggles survive restarts and remain visible to the model-facing catalog immediately. A write is applied to the registry before the settings document commits; a failed persistence leaves the live override in place.

The service is Remote-only and declares no same-process Cordis `Context` merge. Client packages consume it through the explicit [`api-remotes`](../../api/remotes/README.md) assembly rather than importing the Host implementation.

## Model Experience

### Skill catalog membership

#### What the model sees

This package renders no model text itself: the catalog message is rendered and logged by [`dsh-tool-skill`](../../skill/tool-skill/README.md). What this package changes is the membership input — each `skillManager/setInvocation` write stores a global invocation override that the registry's `list` and `get` projections apply, so a skill whose effective policy is model-invocable appears in the catalog with its `name` and normalized description, and a flip to user-invocable-only retires its entry in the next replacement catalog.

#### Token effect

The override itself adds zero tokens. Its effect travels through the catalog: a flip that moves a skill between model-invocable and user-invocable changes which entries the replacement catalog carries, and that delta is the token cost of the catalog message, owned by `dsh-tool-skill`.

#### KV Cache effect

No earlier request tokens are rewritten. The changed membership surfaces as an appended replacement catalog after the reusable prefix (owned by `dsh-tool-skill`); this package writes settings, not request context.

## Known Limitations and Deferred Work

- **Explicit overrides only** — the Remote has no "clear" operation: a toggle writes the complete next policy and the settings document accumulates one entry per touched skill. Overrides with the same value as the provider default are harmless but retained.
- **Global layer only** — overrides apply to every scope's view of the registry, not per preset or workspace.
- **No external-edit watch** — a user editing the settings document while the gateway runs is picked up on the next gateway restart, not live.
