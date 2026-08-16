# @deepseek-ai/dsh-client-ui-settings-subagents

English | [中文](README.zh.md)

Subagents management tab for Web Plugins settings. The browser plugin registers one localized `settings.plugins.tab` contribution with id `subagents`; the Plugins section owns the navigation entry and tab chrome. The tab reads the `subagentManager` Remote (`list`) and shows three sections: **named subagent tools** (every `@deepseek-ai/dsh-tool-subagent` row, such as a custom vision subagent — with tool name, provider, child model, background mode, and source badges), the **backend directory** (every loader backend row plus the installable optional backends; built-in rows render live provider capabilities and their effective config), and the installable backend candidates.

Each named tool and each installed backend offers Edit (replaces its whole config through `updateConfig` — the loader patch layer hot-reloads, so the change takes effect without a restart) and Remove (two-step confirm, appends a disable override through `remove`). Installable candidates open an inline JSON editor pre-filled with the provider name and install through `install`. Catalog reads and every write surface their wire failure text inline with a Retry/Refresh affordance. Copy is bilingual (zh/en) and follows the active locale.

## Model Experience

None, as the tab renders a management surface over the subagentManager Remote and performs no model-facing prompt, tool, message, or provider request of its own.

#### KV Cache effect

None; this package never assembles model input.

## Known Limitations and Deferred Work

- **Whole-config editing only** — the editor replaces the row's entire config; field-level forms per backend are deferred until the schema-form surface covers these configs.
- **Remove disables, it does not delete** — a removed row keeps its loader entry with `disabled: true`; there is no uninstall that drops the row from the patch file.
- **No re-enable** — a backend disabled by Remove cannot be re-enabled from this tab (reinstalling the same module is refused while a disabled row exists).
