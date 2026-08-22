# @deepseek-ai/dsh-client-ui-kanye-pet

English | [中文](README.zh.md)

Kanye-pet settings card for the Plugins settings tab. The browser plugin contributes one localized `settings.plugins.tab` (id `pet`, order 50) to the section, which owns the navigation entry and tab chrome; the tab renders its own card. The card edits the `kanye-pet` settings namespace through `settingsScope`: the `enabled` web-pet toggle, the `desktopPetEnabled` companion toggle, the `character` picker, and staged `size`/`opacity` fields with an explicit save/discard flow.

The character picker loads `/kanye-pet/assets/manifest.json` on mount; when the asset is unreachable the list stays empty and the stored id keeps rendering. Copy is bilingual (zh/en) under the `kanye-pet` locale namespace and follows the active locale.

## Model Experience

None, as the kanye-pet UI is a browser-side settings card; it produces no model-visible output, consumes no model input, and modifies no tool results.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Settings subset only** — the card edits `enabled`, `desktopPetEnabled`, `character`, `size`, and `opacity`; keys the host serves under the `kanye-pet` namespace that the card does not expose stay outside this surface.
- **Character list is best-effort** — the dropdown reads `/kanye-pet/assets/manifest.json`; a missing asset leaves an empty list rather than an error.
