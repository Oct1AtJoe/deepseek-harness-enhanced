# @deepseek-ai/dsh-client-ui-theme-custom

English | [中文](README.zh.md)

Aurora and nebula tech themes for the Web GUI, registered onto the official [`dsh-client-ui-theme`](../ui-theme/README.md) theme registry. The browser plugin injects the theme service and calls `ctx.theme.register(...)` for both definitions; the registry snapshot then drives the Appearance row cubes and the presenter exactly like the built-in pair.

The package ships the moved token files (`aurora.ts`, `nebula.ts` — nebula carries the liquid-glass surface tokens, gradient/glow buttons, and the drift motion), injects the `dsh-button-drift` keyframes the nebula motion token references as a runtime style element, and registers its own settings row (`settings.general.item`, id `appearance-custom`) carrying the two theme cubes — the official Appearance row stays light/dark/system only. It depends on the official ui-theme extension surface: `THEME_PREFERENCES` includes the two ids (so selection persists through the official settings scope) and `boot-theme.ts` maps them to the dark palette pre-activation. The token-consuming `var(--dsw-alias-...)` fallback rules in official component stylesheets are inert without these themes.

## Model experience

No model-facing requests: the plugin only registers CSS token sets into the browser theme registry. It performs no prompt, tool, message, or provider work and touches no session log.

#### KV cache impact

None — no model input is assembled.

## Known Limitations and Deferred Work

- **Mount coupling**: the tech-theme settings row assumes this plugin is mounted; without it, the aurora/nebula cubes are absent (the official row never references the custom ids), and a persisted `aurora`/`nebula` preference is not selectable.
- **Boot flash**: theme activation follows client-plugin activation; the official boot script covers `light`/`dark`/`system` only when the extension surface above is absent.
