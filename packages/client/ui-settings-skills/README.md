# @deepseek-ai/dsh-client-ui-settings-skills

English | [中文](README.zh.md)

Skills management tab for Web Plugins settings. The browser plugin registers one localized `settings.plugins.tab` contribution with id `skills`; the Plugins section owns the navigation entry and tab chrome. It performs no Remote read during plugin activation: selecting the tab for the first time mounts the component, which lazily calls `skillManager/list` through [`api-remotes`](../../api/remotes/README.md).

The tab renders a searchable catalog where each skill card shows its name, description, source, and provider, plus two invocation switches — model-invocable and user-invocable. A switch flip writes the complete next policy through `skillManager/setInvocation` and refreshes the catalog; failures surface in-row without losing the current list. Expanding a card lazily loads the full instruction body through `skillManager/get` with its own retry. The catalog is addressed by the currently selected session, so it mirrors the skills that session's composition serves (host-plane skill providers are disabled in the web composition by design); without an open session the tab shows a hint and performs no Remote read. Copy is bilingual (zh/en) and follows the active locale.

## Model Experience

### Invocation override writes

#### What the model sees

Nothing from this package: the tab renders a management surface and assembles no prompt, tool, or message. Its only model-relevant act is the user's explicit override write through `skillManager/setInvocation`; the skill catalog that changes as a result is rendered and logged by [`dsh-tool-skill`](../../skill/tool-skill/README.md) over the registry state this Remote writes (see [`dsh-host-skill-manager`](../../host/skill-manager/README.md)).

#### Token effect

Zero tokens from this package. A flip's token effect is the catalog delta it causes, carried by the `dsh-tool-skill` catalog message.

#### KV Cache effect

None from this package; it never assembles request context. Catalog append and replacement behavior belongs to the Host-owned injection.

## Known Limitations and Deferred Work

- **No skill creation or deletion** — the tab manages invocation and inspection only; skills are added by dropping files or installing providers.
- **Search covers name, description, source, and provider**, not the instruction body.
