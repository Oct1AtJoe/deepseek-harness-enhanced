/**
 * The plugin-registered "solar" theme (灼日): an amber-orange variant over
 * the dark base palette — deep charcoal-purple surfaces with warm amber
 * aurora pools, amber-tinted matte acrylic (frosted translucent) panels,
 * and glassy tech buttons: warm amber gradient fill with slow drift,
 * a top inner highlight, a 1px glass hairline, and a soft golden-orange
 * outer glow.
 * All values are literal (no var() chains): the presenter applies them as
 * inline body variables, and the effect tokens
 * (`--dsw-alias-button-*`, `--dsw-alias-bg-app-image`,
 * `--dsw-alias-glass-blur`) are consumed by Button.module.css, the send
 * button, and the app-frame/conversation surfaces, defaulting to inert
 * values in the base palettes.
 * Surface tokens are translucent rgba over the amber backdrop; the panel
 * roots add `backdrop-filter: var(--dsw-alias-glass-blur, none)` so the
 * panels read as matte frosted acrylic.
 * Contrast: primary text ~15:1, secondary ~9.8:1, tertiary ~5.9:1 on the
 * base surface; button text ≥4.7:1 over the darkest fill stop.
 */
import type { ThemeTokens } from '@deepseek-ai/dsh-client-ui-theme/client'

/** Alias-token overrides for the solar theme. */
export const SOLAR_TOKENS: ThemeTokens = Object.freeze({
  // Solar backdrop: deep charcoal-purple base with warm amber-gold pools
  // that evoke a dying sun — warm, energetic, glowing.
  '--dsw-alias-bg-app-image':
    'linear-gradient(180deg, rgba(240, 180, 90, 0.08), rgba(240, 180, 90, 0) 24%),'
    + 'radial-gradient(560px 420px at 92% 22%, rgba(252, 200, 114, 0.26), transparent 55%),'
    + 'radial-gradient(540px 420px at 5% 32%, rgba(240, 180, 90, 0.22), transparent 52%)',
  // Acrylic frost: warm amber-tinted blur.
  '--dsw-alias-glass-blur': 'blur(20px) saturate(1.20)',
  '--dsw-alias-surface-glass-blur': 'blur(12px) saturate(1.0)',
  '--dsw-alias-bg-base': 'rgb(18, 14, 16)',
  // Panels are frosted acrylic in warm amber-charcoal tones.
  '--dsw-alias-bg-layer-1': 'rgba(26, 20, 22, 0.58)',
  '--dsw-alias-bg-layer-2': 'rgba(32, 26, 28, 0.55)',
  '--dsw-alias-bg-layer-3': 'rgba(40, 32, 34, 0.78)',
  '--dsw-alias-bg-module-platform': 'rgba(40, 32, 34, 0.78)',
  '--dsw-alias-bg-multi-select': 'rgba(34, 26, 28, 0.80)',
  // Popovers keep higher opacity.
  '--dsw-alias-bg-overlay': 'rgba(58, 46, 48, 0.86)',
  '--dsw-alias-bg-skeleton': 'rgba(255, 255, 255, 0.06)',
  // Overlay masks to keep amber pools visible under panel blur.
  '--dsw-alias-bg-mask-1': 'rgba(0, 0, 0, 0.26)',
  '--dsw-alias-bg-mask-2': 'rgba(0, 0, 0, 0.20)',
  '--dsw-alias-bg-mask-3': 'rgba(0, 0, 0, 0.48)',
  '--dsw-alias-bg-mask-photo': 'rgba(0, 0, 0, 0.88)',
  '--dsw-alias-bg-mask-drop': 'rgba(16, 12, 14, 0.70)',
  // Acrylic hairlines.
  '--dsw-alias-border-inverted': 'rgba(255, 255, 255, 0.08)',
  '--dsw-alias-border-inverted2': 'rgba(255, 255, 255, 0.10)',
  '--dsw-alias-border-l1': 'rgba(255, 255, 255, 0.08)',
  '--dsw-alias-border-l2-darkmode-thin': 'rgba(255, 255, 255, 0.08)',
  '--dsw-alias-border-l2': 'rgba(255, 255, 255, 0.14)',
  '--dsw-alias-border-l3': 'rgba(255, 255, 255, 0.18)',
  '--dsw-alias-border-l4': 'rgba(255, 255, 255, 0.24)',
  '--dsw-alias-brand-primary': 'rgb(240, 180, 90)',
  '--dsw-alias-brand-primary-invert': 'rgb(250, 234, 210)',
  '--dsw-alias-brand-primary-new-colorprimary-new-color': 'rgb(220, 156, 60)',
  '--dsw-alias-brand-text': 'rgb(240, 180, 90)',
  '--dsw-alias-button-contrast-fill': 'rgb(240, 180, 90)',
  '--dsw-alias-button-elevated-fill': 'rgb(38, 30, 32)',
  '--dsw-alias-button-floating-fill': 'rgb(38, 30, 32)',
  '--dsw-alias-button-floating-hover': 'rgb(46, 36, 40)',
  '--dsw-alias-button-ghost-active-border': 'rgb(160, 118, 56)',
  '--dsw-alias-button-ghost-active-fill': 'rgb(46, 36, 40)',
  '--dsw-alias-button-ghost-active-hover': 'rgb(54, 42, 46)',
  '--dsw-alias-button-info-fill': 'rgb(220, 156, 60)',
  '--dsw-alias-button-info-hover': 'rgb(204, 140, 44)',
  // Send-circle fill: translucent amber gradient.
  '--dsw-alias-button-info-bg': 'linear-gradient(135deg, rgba(230, 170, 70, 0.50), rgba(190, 130, 40, 0.32) 55%, rgba(210, 150, 50, 0.44))',
  '--dsw-alias-button-info-bg-hover': 'linear-gradient(135deg, rgba(240, 182, 84, 0.62), rgba(204, 144, 52, 0.40) 55%, rgba(222, 164, 64, 0.54))',
  // Liquid-glass button set (tech): amber gradient fill with slow drift.
  '--dsw-alias-button-radius': '10px',
  '--dsw-alias-button-radius-sm': '8px',
  '--dsw-alias-button-primary-bg': 'linear-gradient(135deg, rgba(220, 156, 60, 0.34), rgba(180, 120, 36, 0.18) 50%, rgba(200, 142, 50, 0.30))',
  '--dsw-alias-button-primary-bg-hover': 'linear-gradient(135deg, rgba(232, 170, 76, 0.44), rgba(194, 134, 48, 0.26) 50%, rgba(214, 156, 64, 0.38))',
  '--dsw-alias-button-primary-bg-size': '200% 100%',
  '--dsw-alias-button-primary-motion': 'dsh-button-drift 5s linear infinite',
  '--dsw-alias-button-glow':
    'inset 0 1px 0 rgba(255, 255, 255, 0.24), 0 0 0 1px rgba(240, 180, 90, 0.22),'
    + '0 0 14px rgba(220, 160, 70, 0.30), 0 8px 28px rgba(180, 120, 36, 0.28)',
  '--dsw-alias-button-glow-hover':
    'inset 0 1px 0 rgba(255, 255, 255, 0.34), 0 0 0 1px rgba(248, 198, 110, 0.36),'
    + '0 0 20px rgba(234, 174, 84, 0.44), 0 12px 36px rgba(194, 134, 48, 0.40)',
  '--dsw-alias-button-press-shadow':
    'inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 0 0 1px rgba(240, 180, 90, 0.14),'
    + '0 4px 12px rgba(180, 120, 36, 0.18)',
  '--dsw-alias-button-press-shift': 'translate(0, 1px)',
  '--dsw-alias-button-outline-glow':
    'inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 0 0 1px rgba(240, 180, 90, 0.26),'
    + '0 6px 18px rgba(180, 120, 36, 0.16)',
  '--dsw-alias-button-send-shift-active': 'translateY(-1px) translate(0, 2px)',
  '--dsw-alias-button-primary-dimmed': 'rgb(46, 36, 40)',
  '--dsw-alias-button-primary-fill': 'rgb(180, 120, 36)',
  '--dsw-alias-button-primary-hover': 'rgb(194, 134, 48)',
  '--dsw-alias-button-tool-bar-fill': 'rgba(46, 36, 38, 0.64)',
  '--dsw-alias-button-tool-bar-fill-invisible': 'rgba(34, 28, 30, 0.42)',
  '--dsw-alias-button-tool-bar-hover': 'rgba(46, 36, 38, 0.72)',
  '--dsw-alias-interactive-bg-active': 'rgba(255, 255, 255, 0.10)',
  '--dsw-alias-interactive-bg-hover': 'rgba(255, 255, 255, 0.06)',
  '--dsw-alias-interactive-bg-hover-accent': 'rgba(240, 180, 90, 0.16)',
  '--dsw-alias-interactive-bg-hover-danger': 'rgba(242, 90, 90, 0.14)',
  '--dsw-alias-interactive-bg-hover-solid': 'rgb(46, 36, 40)',
  '--dsw-alias-label-caption': 'rgb(180, 156, 128)',
  '--dsw-alias-label-dimmed': 'rgb(130, 108, 82)',
  '--dsw-alias-label-primary-bluish': 'rgb(248, 240, 230)',
  '--dsw-alias-label-primary-dimmed': 'rgb(244, 234, 222)',
  '--dsw-alias-label-primary-foreground': 'rgb(252, 248, 244)',
  // Dark ink on light inverted surfaces.
  '--dsw-alias-label-primary-inverted': 'rgb(38, 28, 24)',
  '--dsw-alias-label-primary': 'rgb(248, 242, 236)',
  '--dsw-alias-label-secondary': 'rgb(210, 196, 182)',
  '--dsw-alias-label-tertiary': 'rgb(172, 156, 142)',
  // Code and inline-markup plates: opaque.
  '--dsw-alias-markdown-citation': 'rgb(38, 30, 32)',
  '--dsw-alias-markdown-code-block-banner': 'rgb(22, 18, 20)',
  '--dsw-alias-markdown-code-block': 'rgb(24, 20, 22)',
  '--dsw-alias-markdown-code-segment-selected': 'rgb(46, 36, 40)',
  '--dsw-alias-markdown-code-segment-unselected': 'rgb(24, 20, 22)',
  '--dsw-alias-markdown-inline-code': 'rgb(38, 30, 32)',
  '--dsw-alias-markdown-placeholder': 'rgb(30, 24, 26)',
  '--dsw-alias-markdown-tag': 'rgb(38, 30, 32)',
  '--dsw-alias-scrollbar-bg-l1': 'rgb(56, 44, 46)',
  '--dsw-alias-scrollbar-bg-l2': 'rgb(68, 54, 56)',
  '--dsw-alias-scrollbar-hover-l1': 'rgb(68, 54, 56)',
  '--dsw-alias-scrollbar-hover-l2': 'rgb(82, 66, 68)',
  '--dsw-alias-state-business-primary': 'rgb(220, 156, 60)',
  '--dsw-alias-state-business-tertiary': 'rgb(46, 36, 40)',
  '--dsw-alias-toast-bg': 'rgba(58, 46, 48, 0.88)',
  '--dsw-alias-tooltip-bg': 'rgba(66, 54, 56, 0.90)',
  '--dsw-specific-bubble-highlight': 'rgba(52, 42, 44, 0.84)',
  '--dsw-specific-bubble': 'rgba(40, 32, 34, 0.78)',
  '--dsw-specific-input-major': 'rgba(30, 24, 26, 0.74)',
  '--dsw-specific-login-input': 'rgb(22, 18, 20)',
  '--dsw-specific-selector': 'rgba(38, 30, 32, 0.82)',
  // Sidebar — warm charcoal acrylic.
  '--dsw-specific-sidebar-fill': 'rgba(28, 22, 24, 0.55)',
  '--dsw-specific-sidebar-nav-item-active-accent': 'rgb(50, 38, 42)',
  '--dsw-specific-sidebar-nav-item-active': 'rgb(46, 36, 40)',
  '--dsw-specific-sidebar-nav-item-hover': 'rgb(38, 30, 32)',
  '--dsw-specific-tip': 'rgba(38, 30, 32, 0.80)',
})
