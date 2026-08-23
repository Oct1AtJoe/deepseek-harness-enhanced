/**
 * The plugin-registered "jade" theme (翠渊): an emerald-green variant over
 * the dark base palette — deep forest-teal surfaces with jade aurora pools
 * on the app background, cool-green matte acrylic (frosted translucent)
 * panels, and glassy tech buttons: emerald gradient fill with slow drift,
 * a top inner highlight, a 1px glass hairline, and a soft green outer glow.
 * All values are literal (no var() chains): the presenter applies them as
 * inline body variables, and the effect tokens
 * (`--dsw-alias-button-*`, `--dsw-alias-bg-app-image`,
 * `--dsw-alias-glass-blur`) are consumed by Button.module.css, the send
 * button, and the app-frame/conversation surfaces, defaulting to inert
 * values in the base palettes so other themes keep their current look.
 * Surface tokens are translucent rgba over the jade backdrop; the panel
 * roots add `backdrop-filter: var(--dsw-alias-glass-blur, none)` so the
 * panels read as matte frosted acrylic — the jade pools are dimmed under
 * the lifted panel alphas so the backdrop never wins over the fill.
 * Contrast: primary text ~15:1, secondary ~9.8:1, tertiary ~5.9:1 on the
 * base surface; button text ≥4.7:1 over the darkest fill stop.
 */
import type { ThemeTokens } from '@deepseek-ai/dsh-client-ui-theme/client'

/** Alias-token overrides for the jade theme. */
export const JADE_TOKENS: ThemeTokens = Object.freeze({
  // Jade backdrop: deep forest-teal base with emerald pools that evoke
  // submerged jade in dark water — calm, cool, and rich.
  '--dsw-alias-bg-app-image':
    'linear-gradient(180deg, rgba(130, 210, 170, 0.08), rgba(130, 210, 170, 0) 24%),'
    + 'radial-gradient(560px 420px at 76% 14%, rgba(160, 226, 192, 0.26), transparent 55%),'
    + 'radial-gradient(540px 420px at 7% 55%, rgba(130, 210, 170, 0.22), transparent 52%)',
  // Acrylic frost: green-tinted blur for the jade glass panels.
  '--dsw-alias-glass-blur': 'blur(20px) saturate(1.20)',
  '--dsw-alias-surface-glass-blur': 'blur(12px) saturate(1.0)',
  '--dsw-alias-bg-base': 'rgb(10, 18, 14)',
  // Panels are frosted acrylic in deep teal-green tones.
  '--dsw-alias-bg-layer-1': 'rgba(16, 28, 22, 0.58)',
  '--dsw-alias-bg-layer-2': 'rgba(22, 36, 28, 0.55)',
  '--dsw-alias-bg-layer-3': 'rgba(28, 44, 34, 0.78)',
  '--dsw-alias-bg-module-platform': 'rgba(24, 38, 30, 0.78)',
  '--dsw-alias-bg-multi-select': 'rgba(20, 32, 24, 0.80)',
  // Popovers keep higher opacity so menu text stays legible.
  '--dsw-alias-bg-overlay': 'rgba(40, 60, 48, 0.86)',
  '--dsw-alias-bg-skeleton': 'rgba(255, 255, 255, 0.06)',
  // Overlay masks to keep jade pools visible under panel blur.
  '--dsw-alias-bg-mask-1': 'rgba(0, 0, 0, 0.26)',
  '--dsw-alias-bg-mask-2': 'rgba(0, 0, 0, 0.20)',
  '--dsw-alias-bg-mask-3': 'rgba(0, 0, 0, 0.48)',
  '--dsw-alias-bg-mask-photo': 'rgba(0, 0, 0, 0.88)',
  '--dsw-alias-bg-mask-drop': 'rgba(8, 14, 10, 0.70)',
  // Acrylic hairlines in green-white tones.
  '--dsw-alias-border-inverted': 'rgba(255, 255, 255, 0.08)',
  '--dsw-alias-border-inverted2': 'rgba(255, 255, 255, 0.10)',
  '--dsw-alias-border-l1': 'rgba(255, 255, 255, 0.08)',
  '--dsw-alias-border-l2-darkmode-thin': 'rgba(255, 255, 255, 0.08)',
  '--dsw-alias-border-l2': 'rgba(255, 255, 255, 0.14)',
  '--dsw-alias-border-l3': 'rgba(255, 255, 255, 0.18)',
  '--dsw-alias-border-l4': 'rgba(255, 255, 255, 0.24)',
  '--dsw-alias-brand-primary': 'rgb(130, 210, 170)',
  '--dsw-alias-brand-primary-invert': 'rgb(220, 245, 234)',
  '--dsw-alias-brand-primary-new-colorprimary-new-color': 'rgb(90, 180, 140)',
  '--dsw-alias-brand-text': 'rgb(130, 210, 170)',
  '--dsw-alias-button-contrast-fill': 'rgb(130, 210, 170)',
  '--dsw-alias-button-elevated-fill': 'rgb(22, 36, 28)',
  '--dsw-alias-button-floating-fill': 'rgb(22, 36, 28)',
  '--dsw-alias-button-floating-hover': 'rgb(28, 46, 36)',
  '--dsw-alias-button-ghost-active-border': 'rgb(82, 140, 110)',
  '--dsw-alias-button-ghost-active-fill': 'rgb(28, 46, 36)',
  '--dsw-alias-button-ghost-active-hover': 'rgb(34, 54, 42)',
  '--dsw-alias-button-info-fill': 'rgb(90, 180, 140)',
  '--dsw-alias-button-info-hover': 'rgb(72, 164, 124)',
  // Send-circle fill: translucent emerald gradient.
  '--dsw-alias-button-info-bg': 'linear-gradient(135deg, rgba(80, 190, 140, 0.50), rgba(50, 150, 100, 0.32) 55%, rgba(70, 170, 120, 0.44))',
  '--dsw-alias-button-info-bg-hover': 'linear-gradient(135deg, rgba(92, 204, 154, 0.62), rgba(62, 164, 112, 0.40) 55%, rgba(82, 184, 134, 0.54))',
  // Liquid-glass button set (tech): emerald gradient fill with slow drift,
  // top inner highlight + 1px glass hairline + soft green outer glow.
  '--dsw-alias-button-radius': '10px',
  '--dsw-alias-button-radius-sm': '8px',
  '--dsw-alias-button-primary-bg': 'linear-gradient(135deg, rgba(90, 180, 140, 0.34), rgba(60, 140, 100, 0.18) 50%, rgba(78, 160, 120, 0.30))',
  '--dsw-alias-button-primary-bg-hover': 'linear-gradient(135deg, rgba(104, 194, 154, 0.44), rgba(72, 154, 114, 0.26) 50%, rgba(92, 172, 132, 0.38))',
  '--dsw-alias-button-primary-bg-size': '200% 100%',
  '--dsw-alias-button-primary-motion': 'dsh-button-drift 5s linear infinite',
  '--dsw-alias-button-glow':
    'inset 0 1px 0 rgba(255, 255, 255, 0.24), 0 0 0 1px rgba(130, 210, 170, 0.22),'
    + '0 0 14px rgba(80, 180, 130, 0.30), 0 8px 28px rgba(60, 140, 100, 0.28)',
  '--dsw-alias-button-glow-hover':
    'inset 0 1px 0 rgba(255, 255, 255, 0.34), 0 0 0 1px rgba(154, 224, 190, 0.36),'
    + '0 0 20px rgba(100, 194, 150, 0.44), 0 12px 36px rgba(72, 154, 114, 0.40)',
  '--dsw-alias-button-press-shadow':
    'inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 0 0 1px rgba(130, 210, 170, 0.14),'
    + '0 4px 12px rgba(60, 140, 100, 0.18)',
  '--dsw-alias-button-press-shift': 'translate(0, 1px)',
  '--dsw-alias-button-outline-glow':
    'inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 0 0 1px rgba(130, 210, 170, 0.26),'
    + '0 6px 18px rgba(60, 140, 100, 0.16)',
  '--dsw-alias-button-send-shift-active': 'translateY(-1px) translate(0, 2px)',
  '--dsw-alias-button-primary-dimmed': 'rgb(28, 44, 34)',
  '--dsw-alias-button-primary-fill': 'rgb(60, 140, 100)',
  '--dsw-alias-button-primary-hover': 'rgb(72, 154, 114)',
  '--dsw-alias-button-tool-bar-fill': 'rgba(30, 48, 38, 0.64)',
  '--dsw-alias-button-tool-bar-fill-invisible': 'rgba(26, 38, 30, 0.42)',
  '--dsw-alias-button-tool-bar-hover': 'rgba(30, 48, 38, 0.72)',
  '--dsw-alias-interactive-bg-active': 'rgba(255, 255, 255, 0.10)',
  '--dsw-alias-interactive-bg-hover': 'rgba(255, 255, 255, 0.06)',
  '--dsw-alias-interactive-bg-hover-accent': 'rgba(90, 180, 140, 0.16)',
  '--dsw-alias-interactive-bg-hover-danger': 'rgba(242, 90, 90, 0.14)',
  '--dsw-alias-interactive-bg-hover-solid': 'rgb(28, 46, 36)',
  '--dsw-alias-label-caption': 'rgb(120, 174, 148)',
  '--dsw-alias-label-dimmed': 'rgb(78, 124, 104)',
  '--dsw-alias-label-primary-bluish': 'rgb(226, 244, 236)',
  '--dsw-alias-label-primary-dimmed': 'rgb(218, 240, 230)',
  '--dsw-alias-label-primary-foreground': 'rgb(240, 250, 246)',
  // Dark ink on light inverted surfaces.
  '--dsw-alias-label-primary-inverted': 'rgb(22, 38, 30)',
  '--dsw-alias-label-primary': 'rgb(236, 246, 242)',
  '--dsw-alias-label-secondary': 'rgb(186, 214, 200)',
  '--dsw-alias-label-tertiary': 'rgb(146, 178, 164)',
  // Code and inline-markup plates: opaque.
  '--dsw-alias-markdown-citation': 'rgb(22, 36, 28)',
  '--dsw-alias-markdown-code-block-banner': 'rgb(14, 22, 18)',
  '--dsw-alias-markdown-code-block': 'rgb(16, 24, 20)',
  '--dsw-alias-markdown-code-segment-selected': 'rgb(28, 44, 34)',
  '--dsw-alias-markdown-code-segment-unselected': 'rgb(16, 24, 20)',
  '--dsw-alias-markdown-inline-code': 'rgb(22, 36, 28)',
  '--dsw-alias-markdown-placeholder': 'rgb(20, 30, 24)',
  '--dsw-alias-markdown-tag': 'rgb(22, 36, 28)',
  '--dsw-alias-scrollbar-bg-l1': 'rgb(40, 64, 52)',
  '--dsw-alias-scrollbar-bg-l2': 'rgb(50, 80, 64)',
  '--dsw-alias-scrollbar-hover-l1': 'rgb(50, 80, 64)',
  '--dsw-alias-scrollbar-hover-l2': 'rgb(62, 96, 78)',
  '--dsw-alias-state-business-primary': 'rgb(90, 180, 140)',
  '--dsw-alias-state-business-tertiary': 'rgb(28, 46, 36)',
  '--dsw-alias-toast-bg': 'rgba(40, 64, 50, 0.88)',
  '--dsw-alias-tooltip-bg': 'rgba(48, 74, 58, 0.90)',
  '--dsw-specific-bubble-highlight': 'rgba(38, 58, 48, 0.84)',
  '--dsw-specific-bubble': 'rgba(28, 44, 34, 0.78)',
  '--dsw-specific-input-major': 'rgba(16, 28, 22, 0.74)',
  '--dsw-specific-login-input': 'rgb(14, 22, 18)',
  '--dsw-specific-selector': 'rgba(24, 38, 30, 0.82)',
  // Sidebar — deep teal acrylic.
  '--dsw-specific-sidebar-fill': 'rgba(18, 28, 22, 0.55)',
  '--dsw-specific-sidebar-nav-item-active-accent': 'rgb(32, 52, 40)',
  '--dsw-specific-sidebar-nav-item-active': 'rgb(28, 46, 36)',
  '--dsw-specific-sidebar-nav-item-hover': 'rgb(24, 38, 30)',
  '--dsw-specific-tip': 'rgba(22, 36, 28, 0.80)',
})
