# @deepseek-ai/dsh-client-ui-session-reference

English | [中文](README.zh.md)

Web session-reference '@' source: cross-workspace session mentions for the composer.

Typing `@` opens the trigger menu with the `session` group on top; candidates come from the `session.referenceCandidates` RPC — every logical session except the calling one, ranked by working-directory affinity, so sessions from other workspaces are pickable exactly like local ones. A pick inserts a reference occurrence whose model form is the canonical mention `@[label](dsh-session:…)`. The host prompt boundary (`@deepseek-ai/dsh-host-apiproxy`) strips the mention into readable content and injects the referenced session's bounded, read-only snapshot into the same model step through `ctx.sessionReferenceResolver` (`@deepseek-ai/dsh-session-reference`).

## Architecture

- **Node half** (`src/index.ts`): empty — pure UI plugin, present so the Loader sees it.
- **Browser half** (`src/client/index.ts`): the `@` input-trigger source with a `ReferenceCodec` (clipboard projection `@label`, model serialization `@[label](dsh-session:…)`).
- **Host**: `@deepseek-ai/dsh-host-apiproxy` owns mention parsing (`parseSessionReferenceText`), snapshot preparation, and injection; `@deepseek-ai/dsh-bundle-web-app` mounts both rows.

## Model Experience

Indirectly, through the host prompt boundary (`@deepseek-ai/dsh-host-apiproxy`), which resolves the mention into readable content and injects the referenced session's read-only snapshot into the same model step.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- Candidates are fetched per keystroke; a deployment with a very large corpus should revisit caching (the resolver caps results by its candidate limit).
- Cutting/copying a chip re-inserts the clipboard projection (`@label`), which is plain text rather than a new occurrence.
