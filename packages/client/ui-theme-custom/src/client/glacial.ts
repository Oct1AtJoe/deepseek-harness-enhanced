/**
 * The plugin-registered "glacial" theme (寒渊): an ice-blue variant over
 * the dark base palette — deep navy-slate surfaces with cold cyan aurora
 * pools on the app background, icy-blue matte acrylic (frosted translucent)
 * panels, and glassy tech buttons: cool silver-blue gradient fill with slow
 * drift, a top inner highlight, a 1px glass hairline, and a soft blue-white
 * outer glow.
 * All values are literal (no var() chains): the presenter applies them as
 * inline body variables, and the effect tokens
 * (`--dsw-alias-button-*`, `--dsw-alias-bg-app-image`,
 * `--dsw-alias-glass-blur`) are consumed by Button.module.css, the send
 * button, and the app-frame/conversation surfaces, defaulting to inert
 * values in the base palettes.
 * Surface tokens are translucent rgba over the icy backdrop; the panel
 * roots add `backdrop-filter: var(--dsw-alias-glass-blur, none)` so the
 * panels read as matte frosted acrylic.
 * Contrast: primary text ~15:1, secondary ~9.8:1, tertiary ~5.9:1 on the
 * base surface; button text ≥4.7:1 over the darkest fill stop.
 */
import type { ThemeTokens } from '@deepseek-ai/dsh-client-ui-theme/client'

/** Alias-token overrides for the glacial theme. */
export const GLACIAL_TOKENS: ThemeTokens = Object.freeze({
  // Glacial backdrop: deep navy-slate base with cold cyan pools that evoke
  // arctic ice and frozen depths — clean, cold, ethereal.
  '--dsw-alias-bg-app-image':
    'linear-gradient(180deg, rgba(150, 210, 245, 0.08), rgba(150, 210, 245, 0) 24%),'
    + 'radial-gradient(560px 420px at 82% 20%, rgba(182, 226, 250, 0.26), transparent 55%),'
    + 'radial-gradient(540px 420px at 9% 50%, rgba(150, 210, 245, 0.22), transparent 52%)',
  // Acrylic frost: cool blue-tinted blur for an icy glass feel.
  '--dsw-alias-glass-blur': 'blur(20px) saturate(1.25)',
  '--dsw-alias-surface-glass-blur': 'blur(12px) saturate(1.0)',
  '--dsw-alias-bg-base': 'rgb(10, 12, 22)',
  // Panels are frosted acrylic in cool navy-blue tones.
  '--dsw-alias-bg-layer-1': 'rgba(14, 18, 32, 0.58)',
  '--dsw-alias-bg-layer-2': 'rgba(20, 24, 40, 0.55)',
  '--dsw-alias-bg-layer-3': 'rgba(26, 30, 50, 0.78)',
  '--dsw-alias-bg-module-platform': 'rgba(24, 28, 48, 0.78)',
  '--dsw-alias-bg-multi-select': 'rgba(20, 24, 40, 0.80)',
  // Popovers keep higher opacity.
  '--dsw-alias-bg-overlay': 'rgba(42, 48, 74, 0.86)',
  '--dsw-alias-bg-skeleton': 'rgba(255, 255, 255, 0.06)',
  // Overlay masks to keep icy pools visible under panel blur.
  '--dsw-alias-bg-mask-1': 'rgba(0, 0, 0, 0.26)',
  '--dsw-alias-bg-mask-2': 'rgba(0, 0, 0, 0.20)',
  '--dsw-alias-bg-mask-3': 'rgba(0, 0, 0, 0.48)',
  '--dsw-alias-bg-mask-photo': 'rgba(0, 0, 0, 0.88)',
  '--dsw-alias-bg-mask-drop': 'rgba(8, 10, 18, 0.70)',
  // Acrylic hairlines in cool white-blue tones.
  '--dsw-alias-border-inverted': 'rgba(255, 255, 255, 0.08)',
  '--dsw-alias-border-inverted2': 'rgba(255, 255, 255, 0.10)',
  '--dsw-alias-border-l1': 'rgba(255, 255, 255, 0.08)',
  '--dsw-alias-border-l2-darkmode-thin': 'rgba(255, 255, 255, 0.08)',
  '--dsw-alias-border-l2': 'rgba(255, 255, 255, 0.14)',
  '--dsw-alias-border-l3': 'rgba(255, 255, 255, 0.18)',
  '--dsw-alias-border-l4': 'rgba(255, 255, 255, 0.24)',
  '--dsw-alias-brand-primary': 'rgb(150, 210, 245)',
  '--dsw-alias-brand-primary-invert': 'rgb(226, 242, 252)',
  '--dsw-alias-brand-primary-new-colorprimary-new-color': 'rgb(100, 180, 230)',
  '--dsw-alias-brand-text': 'rgb(150, 210, 245)',
  '--dsw-alias-button-contrast-fill': 'rgb(150, 210, 245)',
  '--dsw-alias-button-elevated-fill': 'rgb(22, 26, 44)',
  '--dsw-alias-button-floating-fill': 'rgb(22, 26, 44)',
  '--dsw-alias-button-floating-hover': 'rgb(28, 34, 56)',
  '--dsw-alias-button-ghost-active-border': 'rgb(80, 140, 180)',
  '--dsw-alias-button-ghost-active-fill': 'rgb(28, 34, 56)',
  '--dsw-alias-button-ghost-active-hover': 'rgb(34, 42, 66)',
  '--dsw-alias-button-info-fill': 'rgb(100, 180, 230)',
  '--dsw-alias-button-info-hover': 'rgb(80, 164, 216)',
  // Send-circle fill: translucent ice-blue gradient.
  '--dsw-alias-button-info-bg': 'linear-gradient(135deg, rgba(100, 190, 240, 0.50), rgba(60, 150, 210, 0.32) 55%, rgba(80, 170, 226, 0.44))',
  '--dsw-alias-button-info-bg-hover': 'linear-gradient(135deg, rgba(114, 202, 248, 0.62), rgba(74, 164, 222, 0.40) 55%, rgba(94, 184, 238, 0.54))',
  // Liquid-glass button set (tech): ice-blue gradient fill with slow drift.
  '--dsw-alias-button-radius': '10px',
  '--dsw-alias-button-radius-sm': '8px',
  '--dsw-alias-button-primary-bg': 'linear-gradient(135deg, rgba(100, 180, 230, 0.34), rgba(60, 140, 200, 0.18) 50%, rgba(80, 164, 216, 0.30))',
  '--dsw-alias-button-primary-bg-hover': 'linear-gradient(135deg, rgba(114, 194, 242, 0.44), rgba(74, 154, 212, 0.26) 50%, rgba(94, 178, 228, 0.38))',
  '--dsw-alias-button-primary-bg-size': '200% 100%',
  '--dsw-alias-button-primary-motion': 'dsh-button-drift 5s linear infinite',
  '--dsw-alias-button-glow':
    'inset 0 1px 0 rgba(255, 255, 255, 0.24), 0 0 0 1px rgba(150, 210, 245, 0.22),'
    + '0 0 14px rgba(100, 180, 230, 0.30), 0 8px 28px rgba(60, 140, 200, 0.28)',
  '--dsw-alias-button-glow-hover':
    'inset 0 1px 0 rgba(255, 255, 255, 0.34), 0 0 0 1px rgba(170, 222, 250, 0.36),'
    + '0 0 20px rgba(120, 194, 240, 0.44), 0 12px 36px rgba(74, 154, 212, 0.40)',
  '--dsw-alias-button-press-shadow':
    'inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 0 0 1px rgba(150, 210, 245, 0.14),'
    + '0 4px 12px rgba(60, 140, 200, 0.18)',
  '--dsw-alias-button-press-shift': 'translate(0, 1px)',
  '--dsw-alias-button-outline-glow':
    'inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 0 0 1px rgba(150, 210, 245, 0.26),'
    + '0 6px 18px rgba(60, 140, 200, 0.16)',
  '--dsw-alias-button-send-shift-active': 'translateY(-1px) translate(0, 2px)',
  '--dsw-alias-button-primary-dimmed': 'rgb(28, 34, 54)',
  '--dsw-alias-button-primary-fill': 'rgb(60, 140, 200)',
  '--dsw-alias-button-primary-hover': 'rgb(74, 154, 212)',
  '--dsw-alias-button-tool-bar-fill': 'rgba(30, 36, 58, 0.64)',
  '--dsw-alias-button-tool-bar-fill-invisible': 'rgba(24, 28, 44, 0.42)',
  '--dsw-alias-button-tool-bar-hover': 'rgba(30, 36, 58, 0.72)',
  '--dsw-alias-interactive-bg-active': 'rgba(255, 255, 255, 0.10)',
  '--dsw-alias-interactive-bg-hover': 'rgba(255, 255, 255, 0.06)',
  '--dsw-alias-interactive-bg-hover-accent': 'rgba(100, 180, 230, 0.16)',
  '--dsw-alias-interactive-bg-hover-danger': 'rgba(242, 90, 90, 0.14)',
  '--dsw-alias-interactive-bg-hover-solid': 'rgb(28, 34, 56)',
  '--dsw-alias-label-caption': 'rgb(130, 172, 200)',
  '--dsw-alias-label-dimmed': 'rgb(86, 122, 150)',
  '--dsw-alias-label-primary-bluish': 'rgb(230, 242, 250)',
  '--dsw-alias-label-primary-dimmed': 'rgb(224, 238, 248)',
  '--dsw-alias-label-primary-foreground': 'rgb(244, 248, 252)',
  // Dark ink on light inverted surfaces.
  '--dsw-alias-label-primary-inverted': 'rgb(20, 26, 44)',
  '--dsw-alias-label-primary': 'rgb(238, 244, 250)',
  '--dsw-alias-label-secondary': 'rgb(190, 210, 226)',
  '--dsw-alias-label-tertiary': 'rgb(148, 172, 192)',
  // Code and inline-markup plates: opaque.
  '--dsw-alias-markdown-citation': 'rgb(22, 26, 44)',
  '--dsw-alias-markdown-code-block-banner': 'rgb(14, 16, 28)',
  '--dsw-alias-markdown-code-block': 'rgb(16, 18, 30)',
  '--dsw-alias-markdown-code-segment-selected': 'rgb(28, 34, 54)',
  '--dsw-alias-markdown-code-segment-unselected': 'rgb(16, 18, 30)',
  '--dsw-alias-markdown-inline-code': 'rgb(22, 26, 44)',
  '--dsw-alias-markdown-placeholder': 'rgb(20, 22, 36)',
  '--dsw-alias-markdown-tag': 'rgb(22, 26, 44)',
  '--dsw-alias-scrollbar-bg-l1': 'rgb(40, 48, 72)',
  '--dsw-alias-scrollbar-bg-l2': 'rgb(50, 60, 90)',
  '--dsw-alias-scrollbar-hover-l1': 'rgb(50, 60, 90)',
  '--dsw-alias-scrollbar-hover-l2': 'rgb(62, 74, 108)',
  '--dsw-alias-state-business-primary': 'rgb(100, 180, 230)',
  '--dsw-alias-state-business-tertiary': 'rgb(28, 34, 56)',
  '--dsw-alias-toast-bg': 'rgba(42, 48, 74, 0.88)',
  '--dsw-alias-tooltip-bg': 'rgba(50, 58, 86, 0.90)',
  '--dsw-specific-bubble-highlight': 'rgba(38, 46, 68, 0.84)',
  '--dsw-specific-bubble': 'rgba(28, 34, 54, 0.78)',
  '--dsw-specific-input-major': 'rgba(16, 20, 36, 0.74)',
  '--dsw-specific-login-input': 'rgb(14, 16, 28)',
  '--dsw-specific-selector': 'rgba(24, 28, 48, 0.82)',
  // Sidebar — deep navy acrylic.
  '--dsw-specific-sidebar-fill': 'rgba(16, 20, 36, 0.55)',
  '--dsw-specific-sidebar-nav-item-active-accent': 'rgb(32, 38, 62)',
  '--dsw-specific-sidebar-nav-item-active': 'rgb(28, 34, 56)',
  '--dsw-specific-sidebar-nav-item-hover': 'rgb(24, 28, 48)',
  '--dsw-specific-tip': 'rgba(22, 26, 44, 0.80)',
})
