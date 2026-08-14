/**
 * The built-in "nebula" theme (幻彩星云): a deep-space violet-blue variant
 * over the dark base palette with a retro-tech feel — radial aurora pools on
 * the app surfaces, and 8-bit pixel buttons: hard corners, a two-tone
 * top-lit fill, inset light/dark double edge, hard drop shadow, and a press
 * that collapses the shadow and shifts the button 2px. All values are
 * literal (no var() chains): the presenter applies them as inline body
 * variables, and the effect tokens (`--dsw-alias-button-*`, 
 * `--dsw-alias-bg-app-image`) are consumed by Button.module.css, the send
 * button, and the app-frame/conversation surfaces, defaulting to inert
 * values in the base palettes so light/dark/aurora keep their current look.
 * Contrast: primary text ~15:1, secondary ~9.8:1, tertiary ~5.9:1 on the
 * base surface; button text ≥4.7:1 over the darkest fill stop.
 */
import type { ThemeTokens } from './index.ts'

/** Alias-token overrides for the nebula theme. */
export const NEBULA_TOKENS: ThemeTokens = Object.freeze({
  // Two aurora pools over the chat column, placed where surfaces stay
  // transparent (top-right clears the collapsed details panel; the second
  // sits over the transcript mid-left — the input bar and details panel
  // would cover a bottom corner).
  '--dsw-alias-bg-app-image':
    'radial-gradient(1100px 560px at 88% -12%, rgba(91, 108, 255, 0.2), transparent 62%),'
    + 'radial-gradient(900px 520px at 6% 44%, rgba(139, 92, 246, 0.16), transparent 60%)',
  '--dsw-alias-bg-base': 'rgb(13, 15, 29)',
  '--dsw-alias-bg-layer-1': 'rgb(18, 21, 40)',
  '--dsw-alias-bg-layer-2': 'rgb(24, 27, 51)',
  '--dsw-alias-bg-layer-3': 'rgb(31, 34, 63)',
  '--dsw-alias-bg-module-platform': 'rgb(26, 29, 54)',
  '--dsw-alias-bg-multi-select': 'rgb(22, 24, 46)',
  '--dsw-alias-bg-overlay': 'rgb(44, 48, 90)',
  '--dsw-alias-bg-skeleton': 'rgba(255, 255, 255, 0.08)',
  '--dsw-alias-bg-mask-1': 'rgba(0, 0, 0, 0.5)',
  '--dsw-alias-bg-mask-2': 'rgba(0, 0, 0, 0.2)',
  '--dsw-alias-bg-mask-3': 'rgba(0, 0, 0, 0.48)',
  '--dsw-alias-bg-mask-photo': 'rgba(0, 0, 0, 0.88)',
  '--dsw-alias-bg-mask-drop': 'rgba(12, 13, 26, 0.7)',
  '--dsw-alias-border-inverted': 'rgba(255, 255, 255, 0.06)',
  '--dsw-alias-border-inverted2': 'rgba(255, 255, 255, 0.08)',
  '--dsw-alias-border-l1': 'rgba(255, 255, 255, 0.06)',
  '--dsw-alias-border-l2-darkmode-thin': 'rgba(255, 255, 255, 0.06)',
  '--dsw-alias-border-l2': 'rgba(255, 255, 255, 0.1)',
  '--dsw-alias-border-l3': 'rgba(255, 255, 255, 0.14)',
  '--dsw-alias-border-l4': 'rgba(255, 255, 255, 0.18)',
  '--dsw-alias-brand-primary': 'rgb(168, 190, 255)',
  '--dsw-alias-brand-primary-invert': 'rgb(232, 238, 255)',
  '--dsw-alias-brand-primary-new-colorprimary-new-color': 'rgb(122, 144, 255)',
  '--dsw-alias-brand-text': 'rgb(168, 190, 255)',
  '--dsw-alias-button-contrast-fill': 'rgb(168, 190, 255)',
  '--dsw-alias-button-elevated-fill': 'rgb(24, 27, 51)',
  '--dsw-alias-button-floating-fill': 'rgb(24, 27, 51)',
  '--dsw-alias-button-floating-hover': 'rgb(31, 34, 63)',
  '--dsw-alias-button-ghost-active-border': 'rgb(106, 118, 190)',
  '--dsw-alias-button-ghost-active-fill': 'rgb(31, 34, 63)',
  '--dsw-alias-button-ghost-active-hover': 'rgb(37, 41, 76)',
  '--dsw-alias-button-info-fill': 'rgb(122, 144, 255)',
  '--dsw-alias-button-info-hover': 'rgb(104, 128, 246)',
  // Send-circle fill: same two-tone pixel ramp as the primary buttons,
  // overlaid on the solid info fill (which stays color-safe for others).
  '--dsw-alias-button-info-bg': 'linear-gradient(180deg, rgb(110, 120, 255) 0 50%, rgb(76, 94, 246) 50% 100%)',
  // Pixel button set (8-bit): two-tone top-lit fill, inset light/dark double
  // edge, a hard drop shadow, and a press that collapses the shadow and
  // shifts the button 2px — with a comfortably rounded 8px corner (6px for
  // compact buttons) instead of a harsh square, so the set stays friendly.
  // All effect tokens are inert in the base palettes, so light/dark/aurora
  // keep their capsule buttons.
  '--dsw-alias-button-radius': '8px',
  '--dsw-alias-button-radius-sm': '6px',
  '--dsw-alias-button-primary-bg': 'linear-gradient(180deg, rgb(110, 120, 255) 0 50%, rgb(76, 94, 246) 50% 100%)',
  '--dsw-alias-button-primary-bg-hover': 'linear-gradient(180deg, rgb(126, 134, 255) 0 50%, rgb(92, 110, 255) 50% 100%)',
  '--dsw-alias-button-glow':
    'inset 0 -3px 0 rgba(12, 10, 26, 0.45), inset 0 3px 0 rgba(255, 255, 255, 0.22),'
    + 'inset 3px 0 0 rgba(255, 255, 255, 0.14), inset -3px 0 0 rgba(12, 10, 26, 0.35),'
    + '3px 3px 0 rgb(16, 12, 34)',
  '--dsw-alias-button-glow-hover':
    'inset 0 -3px 0 rgba(12, 10, 26, 0.45), inset 0 3px 0 rgba(255, 255, 255, 0.32),'
    + 'inset 3px 0 0 rgba(255, 255, 255, 0.2), inset -3px 0 0 rgba(12, 10, 26, 0.35),'
    + '4px 4px 0 rgb(16, 12, 34)',
  '--dsw-alias-button-press-shadow':
    'inset 0 -2px 0 rgba(12, 10, 26, 0.45), inset 0 2px 0 rgba(255, 255, 255, 0.16),'
    + '1px 1px 0 rgb(16, 12, 34)',
  '--dsw-alias-button-press-shift': 'translate(2px, 2px)',
  '--dsw-alias-button-outline-glow':
    'inset 0 -2px 0 rgba(12, 10, 26, 0.4), inset 0 2px 0 rgba(255, 255, 255, 0.18),'
    + '2px 2px 0 rgb(16, 12, 34)',
  '--dsw-alias-button-send-shift-active': 'translateY(-2px) translate(2px, 2px)',
  '--dsw-alias-button-primary-dimmed': 'rgb(32, 36, 70)',
  '--dsw-alias-button-primary-fill': 'rgb(91, 106, 245)',
  '--dsw-alias-button-primary-hover': 'rgb(104, 118, 255)',
  '--dsw-alias-button-tool-bar-fill': 'rgba(31, 34, 63, 0.5)',
  '--dsw-alias-button-tool-bar-fill-invisible': 'rgba(31, 31, 31, 0.36)',
  '--dsw-alias-button-tool-bar-hover': 'rgba(31, 34, 63, 0.6)',
  '--dsw-alias-interactive-bg-active': 'rgba(255, 255, 255, 0.12)',
  '--dsw-alias-interactive-bg-hover': 'rgba(255, 255, 255, 0.07)',
  '--dsw-alias-interactive-bg-hover-accent': 'rgba(122, 144, 255, 0.18)',
  '--dsw-alias-interactive-bg-hover-danger': 'rgba(242, 90, 90, 0.15)',
  '--dsw-alias-interactive-bg-hover-solid': 'rgb(31, 34, 63)',
  '--dsw-alias-label-caption': 'rgb(129, 138, 178)',
  '--dsw-alias-label-dimmed': 'rgb(86, 93, 130)',
  '--dsw-alias-label-primary-bluish': 'rgb(230, 235, 255)',
  '--dsw-alias-label-primary-dimmed': 'rgb(224, 229, 252)',
  '--dsw-alias-label-primary-foreground': 'rgb(245, 246, 255)',
  // Text knocked out on light inverted surfaces (toast plate, attachment
  // remove badge, the HARNESS badge inside the wordmark): dark indigo —
  // the light periwinkle contrast-fill and near-white wordmark plate both
  // need dark ink, not the light value (that made the badge text blend in).
  '--dsw-alias-label-primary-inverted': 'rgb(30, 33, 62)',
  '--dsw-alias-label-primary': 'rgb(236, 240, 255)',
  '--dsw-alias-label-secondary': 'rgb(185, 192, 224)',
  '--dsw-alias-label-tertiary': 'rgb(140, 148, 186)',
  '--dsw-alias-markdown-citation': 'rgb(24, 27, 51)',
  '--dsw-alias-markdown-code-block-banner': 'rgb(16, 18, 34)',
  '--dsw-alias-markdown-code-block': 'rgb(17, 19, 36)',
  '--dsw-alias-markdown-code-segment-selected': 'rgb(31, 34, 63)',
  '--dsw-alias-markdown-code-segment-unselected': 'rgb(17, 19, 36)',
  '--dsw-alias-markdown-inline-code': 'rgb(24, 27, 51)',
  '--dsw-alias-markdown-placeholder': 'rgb(22, 24, 46)',
  '--dsw-alias-markdown-tag': 'rgb(24, 27, 51)',
  '--dsw-alias-scrollbar-bg-l1': 'rgb(40, 44, 80)',
  '--dsw-alias-scrollbar-bg-l2': 'rgb(52, 58, 104)',
  '--dsw-alias-scrollbar-hover-l1': 'rgb(52, 58, 104)',
  '--dsw-alias-scrollbar-hover-l2': 'rgb(62, 70, 124)',
  '--dsw-alias-state-business-primary': 'rgb(122, 144, 255)',
  '--dsw-alias-state-business-tertiary': 'rgb(30, 35, 66)',
  '--dsw-alias-toast-bg': 'rgb(44, 48, 90)',
  '--dsw-alias-tooltip-bg': 'rgb(50, 55, 102)',
  '--dsw-specific-bubble-highlight': 'rgb(40, 44, 82)',
  '--dsw-specific-bubble': 'rgb(28, 31, 58)',
  '--dsw-specific-input-major': 'rgb(18, 21, 40)',
  '--dsw-specific-login-input': 'rgb(16, 18, 36)',
  '--dsw-specific-selector': 'rgb(26, 29, 54)',
  '--dsw-specific-sidebar-fill': 'rgb(11, 12, 24)',
  '--dsw-specific-sidebar-nav-item-active-accent': 'rgb(36, 40, 76)',
  '--dsw-specific-sidebar-nav-item-active': 'rgb(31, 34, 63)',
  '--dsw-specific-sidebar-nav-item-hover': 'rgb(26, 29, 54)',
  '--dsw-specific-tip': 'rgb(22, 24, 46)',
})
