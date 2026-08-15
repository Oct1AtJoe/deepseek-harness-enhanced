# @deepseek-ai/dsh-client-ui-theme-custom

English | [中文](README.zh.md)

Aurora and nebula tech themes for the Web GUI, registered onto the official [`dsh-client-ui-theme`](../ui-theme/README.md) theme registry. The browser plugin injects the theme service and calls `ctx.theme.register(...)` for both definitions; the registry snapshot then drives the Appearance row cubes and the presenter exactly like the built-in pair.

The package ships the moved token files (`aurora.ts`, `nebula.ts` — nebula carries the liquid-glass surface tokens, gradient/glow buttons, and the drift motion) plus `src/styles/theme-extras.css` with the `dsh-button-drift` keyframes the nebula motion token references. It depends on the official ui-theme extension surface: `THEME_PREFERENCES` includes the two ids (so selection persists through the official settings scope), `boot-theme.ts` maps them to the dark palette pre-activation, `AppearanceRow.tsx` renders their cubes, and `locales.ts` carries the display names. The token-consuming `var(--dsw-alias-...)` fallback rules in official component stylesheets are inert without these themes.

## Model experience

No model-facing requests: the plugin only registers CSS token sets into the browser theme registry. It performs no prompt, tool, message, or provider work and touches no session log.

#### KV cache impact

None — no model input is assembled.

## Known Limitations and Deferred Work

- **Mount coupling**: the Appearance row's aurora/nebula cubes assume this plugin is mounted; without it, selecting a cube throws `theme "aurora" is not registered`. Mount both together.
- **Boot flash**: theme activation follows client-plugin activation; the official boot script covers `light`/`dark`/`system` only when the extension surface above is absent.
