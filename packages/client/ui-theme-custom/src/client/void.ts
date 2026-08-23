/**
 * The plugin-registered "void" theme (冥夜): a deep neutral-gray variant with
 * a blurred-glass backplate — the background uses a dark graphite base with
 * soft gray aurora pools that shine through translucent acrylic panels,
 * creating a通透 (transparent/deep) glass backplate feel. Panels carry lower
 * alpha values than the nebula so the pools remain visible under the frost,
 * and the glass blur is tuned for a soft matte finish. The palette is kept
 * in the neutral gray range — no blue, no red — evoking volcanic stone
 * viewed through a light-frosted pane.
 * All values are literal (no var() chains): the presenter applies them as
 * inline body variables, and the effect tokens
 * (`--dsw-alias-button-*`, `--dsw-alias-bg-app-image`,
 * `--dsw-alias-glass-blur`) are consumed by Button.module.css, the send
 * button, and the app-frame/conversation surfaces, defaulting to inert
 * values in the base palettes.
 * Surface tokens are translucent rgba over the aurora backdrop; the panel
 * roots add `backdrop-filter: var(--dsw-alias-glass-blur, none)` so the
 * panels read as matte frosted acrylic — the pools are visible through the
 * frost at a dimmed matte distance.
 * Contrast: primary text ~14:1, secondary ~9:1, tertiary ~5.5:1 on the
 * base surface; button text ≥4.5:1 over the darkest fill stop.
 */
import type { ThemeTokens } from '@deepseek-ai/dsh-client-ui-theme/client'

/** Alias-token overrides for the void theme. */
export const VOID_TOKENS: ThemeTokens = Object.freeze({
  // Deep neutral backdrop: dark graphite base with soft warm-gray aurora
  // pools that create depth — like looking through glass into volcanic
  // stone. Pools stay visible through the translucent panel alphas.
  '--dsw-alias-bg-app-image':
    'linear-gradient(180deg, rgba(212, 210, 220, 0.08), rgba(212, 210, 220, 0) 24%),'
    + 'radial-gradient(560px 420px at 88% 18%, rgba(228, 222, 238, 0.20), transparent 55%),'
    + 'radial-gradient(540px 420px at 3% 42%, rgba(200, 192, 214, 0.30), transparent 52%)',
  // Glass blur: lighter blur so the pools read as soft glow through frost.
  '--dsw-alias-glass-blur': 'blur(24px) saturate(1.05)',
  // Surface glass blur for panels that can't use --dsw-alias-glass-blur
  // directly (sidebar, bubbles, details) due to fixed-positioned child
  // constraints — consumed via plugin-injected ::before pseudo-elements.
  '--dsw-alias-surface-glass-blur': 'blur(12px) saturate(1.0)',
  '--dsw-alias-bg-base': 'rgb(13, 13, 16)',
  // Translucent acrylic panels — low alpha so the aurora pools stay visible
  // through the frost (通透 glass backplate feel).
  '--dsw-alias-bg-layer-1': 'rgba(20, 20, 26, 0.58)',
  '--dsw-alias-bg-layer-2': 'rgba(27, 27, 32, 0.60)',
  '--dsw-alias-bg-layer-3': 'rgba(33, 33, 40, 0.78)',
  '--dsw-alias-bg-module-platform': 'rgba(29, 29, 36, 0.70)',
  '--dsw-alias-bg-multi-select': 'rgba(25, 25, 30, 0.72)',
  // Popovers and overlays: higher opacity for legibility.
  '--dsw-alias-bg-overlay': 'rgba(46, 46, 56, 0.86)',
  '--dsw-alias-bg-skeleton': 'rgba(255, 255, 255, 0.06)',
  // Overlay masks.
  '--dsw-alias-bg-mask-1': 'rgba(0, 0, 0, 0.26)',
  '--dsw-alias-bg-mask-2': 'rgba(0, 0, 0, 0.20)',
  '--dsw-alias-bg-mask-3': 'rgba(0, 0, 0, 0.48)',
  '--dsw-alias-bg-mask-photo': 'rgba(0, 0, 0, 0.88)',
  '--dsw-alias-bg-mask-drop': 'rgba(9, 9, 12, 0.70)',
  // Neutral gray hairline borders.
  '--dsw-alias-border-inverted': 'rgba(200, 198, 204, 0.08)',
  '--dsw-alias-border-inverted2': 'rgba(200, 198, 204, 0.10)',
  '--dsw-alias-border-l1': 'rgba(200, 198, 204, 0.08)',
  '--dsw-alias-border-l2-darkmode-thin': 'rgba(200, 198, 204, 0.08)',
  '--dsw-alias-border-l2': 'rgba(200, 198, 204, 0.14)',
  '--dsw-alias-border-l3': 'rgba(200, 198, 204, 0.18)',
  '--dsw-alias-border-l4': 'rgba(200, 198, 204, 0.24)',
  // Brand: neutral gray-silver accent.
  '--dsw-alias-brand-primary': 'rgb(196, 194, 202)',
  '--dsw-alias-brand-primary-invert': 'rgb(240, 238, 244)',
  '--dsw-alias-brand-primary-new-colorprimary-new-color': 'rgb(168, 166, 176)',
  '--dsw-alias-brand-text': 'rgb(196, 194, 202)',
  '--dsw-alias-button-contrast-fill': 'rgb(196, 194, 202)',
  '--dsw-alias-button-elevated-fill': 'rgb(22, 22, 27)',
  '--dsw-alias-button-floating-fill': 'rgb(22, 22, 27)',
  '--dsw-alias-button-floating-hover': 'rgb(28, 28, 34)',
  '--dsw-alias-button-ghost-active-border': 'rgb(122, 120, 130)',
  '--dsw-alias-button-ghost-active-fill': 'rgb(28, 28, 34)',
  '--dsw-alias-button-ghost-active-hover': 'rgb(34, 34, 40)',
  '--dsw-alias-button-info-fill': 'rgb(168, 166, 176)',
  '--dsw-alias-button-info-hover': 'rgb(150, 148, 160)',
  // Send-circle fill: translucent neutral gray gradient.
  '--dsw-alias-button-info-bg': 'linear-gradient(135deg, rgba(168, 166, 176, 0.48), rgba(138, 136, 148, 0.30) 55%, rgba(158, 156, 168, 0.40))',
  '--dsw-alias-button-info-bg-hover': 'linear-gradient(135deg, rgba(182, 180, 190, 0.60), rgba(152, 150, 162, 0.38) 55%, rgba(172, 170, 182, 0.52))',
  // Glass buttons: neutral gray gradient with slow drift.
  '--dsw-alias-button-radius': '10px',
  '--dsw-alias-button-radius-sm': '8px',
  '--dsw-alias-button-primary-bg': 'linear-gradient(135deg, rgba(168, 166, 176, 0.32), rgba(140, 138, 150, 0.16) 50%, rgba(158, 156, 168, 0.26))',
  '--dsw-alias-button-primary-bg-hover': 'linear-gradient(135deg, rgba(182, 180, 190, 0.42), rgba(154, 152, 164, 0.24) 50%, rgba(172, 170, 182, 0.36))',
  '--dsw-alias-button-primary-bg-size': '200% 100%',
  '--dsw-alias-button-primary-motion': 'dsh-button-drift 5s linear infinite',
  '--dsw-alias-button-glow':
    'inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 0 0 1px rgba(196, 194, 202, 0.20),'
    + '0 0 12px rgba(168, 166, 176, 0.24), 0 8px 28px rgba(134, 132, 144, 0.20)',
  '--dsw-alias-button-glow-hover':
    'inset 0 1px 0 rgba(255, 255, 255, 0.32), 0 0 0 1px rgba(210, 208, 218, 0.34),'
    + '0 0 18px rgba(184, 182, 194, 0.36), 0 12px 36px rgba(148, 146, 158, 0.32)',
  '--dsw-alias-button-press-shadow':
    'inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 0 0 1px rgba(196, 194, 202, 0.12),'
    + '0 4px 12px rgba(134, 132, 144, 0.14)',
  '--dsw-alias-button-press-shift': 'translate(0, 1px)',
  '--dsw-alias-button-outline-glow':
    'inset 0 1px 0 rgba(255, 255, 255, 0.16), 0 0 0 1px rgba(196, 194, 202, 0.24),'
    + '0 6px 18px rgba(134, 132, 144, 0.12)',
  '--dsw-alias-button-send-shift-active': 'translateY(-1px) translate(0, 2px)',
  '--dsw-alias-button-primary-dimmed': 'rgb(34, 34, 42)',
  '--dsw-alias-button-primary-fill': 'rgb(140, 138, 150)',
  '--dsw-alias-button-primary-hover': 'rgb(154, 152, 164)',
  '--dsw-alias-button-tool-bar-fill': 'rgba(34, 34, 42, 0.64)',
  '--dsw-alias-button-tool-bar-fill-invisible': 'rgba(26, 26, 32, 0.42)',
  '--dsw-alias-button-tool-bar-hover': 'rgba(34, 34, 42, 0.72)',
  '--dsw-alias-interactive-bg-active': 'rgba(200, 198, 204, 0.10)',
  '--dsw-alias-interactive-bg-hover': 'rgba(200, 198, 204, 0.06)',
  '--dsw-alias-interactive-bg-hover-accent': 'rgba(168, 166, 176, 0.16)',
  '--dsw-alias-interactive-bg-hover-danger': 'rgba(242, 90, 90, 0.12)',
  '--dsw-alias-interactive-bg-hover-solid': 'rgb(28, 28, 34)',
  // Labels: neutral gray text hierarchy.
  '--dsw-alias-label-caption': 'rgb(140, 138, 150)',
  '--dsw-alias-label-dimmed': 'rgb(96, 94, 106)',
  '--dsw-alias-label-primary-bluish': 'rgb(238, 236, 242)',
  '--dsw-alias-label-primary-dimmed': 'rgb(232, 230, 238)',
  '--dsw-alias-label-primary-foreground': 'rgb(248, 246, 252)',
  '--dsw-alias-label-primary-inverted': 'rgb(18, 18, 22)',
  '--dsw-alias-label-primary': 'rgb(242, 240, 246)',
  '--dsw-alias-label-secondary': 'rgb(196, 194, 204)',
  '--dsw-alias-label-tertiary': 'rgb(152, 150, 162)',
  // Code and inline-markup plates: opaque.
  '--dsw-alias-markdown-citation': 'rgb(24, 24, 30)',
  '--dsw-alias-markdown-code-block-banner': 'rgb(12, 12, 16)',
  '--dsw-alias-markdown-code-block': 'rgb(14, 14, 18)',
  '--dsw-alias-markdown-code-segment-selected': 'rgb(34, 34, 42)',
  '--dsw-alias-markdown-code-segment-unselected': 'rgb(14, 14, 18)',
  '--dsw-alias-markdown-inline-code': 'rgb(24, 24, 30)',
  '--dsw-alias-markdown-placeholder': 'rgb(20, 20, 26)',
  '--dsw-alias-markdown-tag': 'rgb(24, 24, 30)',
  // Scrollbar: neutral gray.
  '--dsw-alias-scrollbar-bg-l1': 'rgb(40, 40, 50)',
  '--dsw-alias-scrollbar-bg-l2': 'rgb(50, 50, 62)',
  '--dsw-alias-scrollbar-hover-l1': 'rgb(50, 50, 62)',
  '--dsw-alias-scrollbar-hover-l2': 'rgb(60, 60, 74)',
  '--dsw-alias-state-business-primary': 'rgb(168, 166, 176)',
  '--dsw-alias-state-business-tertiary': 'rgb(34, 34, 42)',
  '--dsw-alias-toast-bg': 'rgba(46, 46, 56, 0.88)',
  '--dsw-alias-tooltip-bg': 'rgba(54, 54, 66, 0.90)',
  // Bubbles and inputs: translucent neutral gray.
  '--dsw-specific-bubble-highlight': 'rgba(40, 40, 50, 0.84)',
  '--dsw-specific-bubble': 'rgba(26, 26, 32, 0.76)',
  '--dsw-specific-input-major': 'rgba(21, 21, 26, 0.70)',
  '--dsw-specific-login-input': 'rgb(12, 12, 16)',
  '--dsw-specific-selector': 'rgba(29, 29, 36, 0.80)',
  // Sidebar — translucent neutral dark-gray acrylic.
  '--dsw-specific-sidebar-fill': 'rgba(18, 18, 24, 0.55)',
  '--dsw-specific-sidebar-nav-item-active-accent': 'rgb(33, 33, 40)',
  '--dsw-specific-sidebar-nav-item-active': 'rgb(29, 29, 36)',
  '--dsw-specific-sidebar-nav-item-hover': 'rgb(24, 24, 30)',
  '--dsw-specific-tip': 'rgba(24, 24, 30, 0.78)',
})
