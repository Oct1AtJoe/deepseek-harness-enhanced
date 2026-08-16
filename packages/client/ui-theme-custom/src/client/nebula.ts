/**
 * The plugin-registered "nebula" theme (幻彩星云): a deep-space violet-blue variant
 * over the dark base palette with a retro-tech feel — radial aurora pools on
 * the app surfaces, matte acrylic (frosted translucent) panels, and glassy
 * tech buttons: translucent gradient fill with slow drift, a top inner
 * highlight, a 1px glass hairline, and a soft blue-violet outer glow. All
 * values are literal (no var() chains): the presenter applies them as
 * inline body variables, and the effect tokens
 * (`--dsw-alias-button-*`, `--dsw-alias-bg-app-image`,
 * `--dsw-alias-glass-blur`) are consumed by Button.module.css, the send
 * button, and the app-frame/conversation surfaces, defaulting to inert
 * values in the base palettes so light/dark/aurora keep their current look.
 * Surface tokens are translucent rgba over the aurora backdrop; the panel
 * roots that carry no fixed-positioned descendants add
 * `backdrop-filter: var(--dsw-alias-glass-blur, none)` so the panels read
 * as matte frosted acrylic — the aurora pools are dimmed under the lifted
 * panel alphas so the backdrop never wins over the fill (a bright backdrop
 * reads as glass, a dim one as acrylic), while light/dark/aurora resolve
 * the token to `none` and stay opaque-flat.
 * Contrast: primary text ~15:1, secondary ~9.8:1, tertiary ~5.9:1 on the
 * base surface; button text ≥4.7:1 over the darkest fill stop.
 */
import type { ThemeTokens } from '@deepseek-ai/dsh-client-ui-theme/client'

/** Alias-token overrides for the nebula theme. */
export const NEBULA_TOKENS: ThemeTokens = Object.freeze({
  // Acrylic glass recipe: the aurora pools are dimmed below the panel fills
  // (a bright backdrop reads as "see-through", a dim one as matte acrylic),
  // with a top light wash so the panels catch an edge highlight where the
  // frost lets the wash through. Alpha on the pools stays under every panel
  // fill so the gradient never wins over the glass. The center pool keeps
  // the dialog area lit: centered overlays otherwise sit between pools and
  // their frost has nothing to blur.
  '--dsw-alias-bg-app-image':
    'linear-gradient(180deg, rgba(148, 163, 255, 0.1), rgba(148, 163, 255, 0) 26%),'
    + 'radial-gradient(1100px 560px at 88% -12%, rgba(91, 108, 255, 0.28), transparent 62%),'
    + 'radial-gradient(1000px 560px at 4% 34%, rgba(139, 92, 246, 0.3), transparent 60%),'
    + 'radial-gradient(900px 520px at 50% 46%, rgba(122, 108, 255, 0.26), transparent 62%),'
    + 'radial-gradient(900px 500px at 52% 96%, rgba(79, 70, 229, 0.2), transparent 62%)',
  // Acrylic frost applied by the surface-root rules: heavier blur and lower
  // saturation than the old liquid look — the fill reads matte frosted, not
  // bright glass. `none` in the base palettes keeps light/dark/aurora
  // unaffected.
  '--dsw-alias-glass-blur': 'blur(20px) saturate(1.25)',
  '--dsw-alias-bg-base': 'rgb(11, 13, 25)',
  // Panels are frosted acrylic: indigo fills lifted well past the base
  // palette alphas (the translucent glass used to let the aurora win; the
  // acrylic keeps the tint but holds the backdrop at a matte distance),
  // blurred by the owning surface roots (see the module doc above).
  '--dsw-alias-bg-layer-1': 'rgba(20, 23, 44, 0.72)',
  '--dsw-alias-bg-layer-2': 'rgba(26, 30, 56, 0.68)',
  '--dsw-alias-bg-layer-3': 'rgba(33, 37, 68, 0.84)',
  '--dsw-alias-bg-module-platform': 'rgba(28, 32, 59, 0.78)',
  '--dsw-alias-bg-multi-select': 'rgba(24, 27, 51, 0.8)',
  // Popovers keep a higher opacity floor than panels so menu text stays
  // legible over the brightest aurora pool.
  '--dsw-alias-bg-overlay': 'rgba(47, 52, 96, 0.86)',
  '--dsw-alias-bg-skeleton': 'rgba(255, 255, 255, 0.08)',
  // Overlay masks stay lighter than the base dark palette: a heavy scrim
  // (0.5) flattens the aurora to black, and a frosted panel blurs black —
  // the glass has nothing to show. 0.26 keeps the pools visible as a soft
  // glow under the panel's own blur, so dialogs read as matte acrylic.
  '--dsw-alias-bg-mask-1': 'rgba(0, 0, 0, 0.26)',
  '--dsw-alias-bg-mask-2': 'rgba(0, 0, 0, 0.2)',
  '--dsw-alias-bg-mask-3': 'rgba(0, 0, 0, 0.48)',
  '--dsw-alias-bg-mask-photo': 'rgba(0, 0, 0, 0.88)',
  '--dsw-alias-bg-mask-drop': 'rgba(12, 13, 26, 0.7)',
  // Acrylic hairlines: lifted so panel edges read as milled plastic seams
  // rather than invisible strokes.
  '--dsw-alias-border-inverted': 'rgba(255, 255, 255, 0.1)',
  '--dsw-alias-border-inverted2': 'rgba(255, 255, 255, 0.12)',
  '--dsw-alias-border-l1': 'rgba(255, 255, 255, 0.1)',
  '--dsw-alias-border-l2-darkmode-thin': 'rgba(255, 255, 255, 0.1)',
  '--dsw-alias-border-l2': 'rgba(255, 255, 255, 0.16)',
  '--dsw-alias-border-l3': 'rgba(255, 255, 255, 0.2)',
  '--dsw-alias-border-l4': 'rgba(255, 255, 255, 0.26)',
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
  // Send-circle fill: translucent glass gradient (the send button prefers
  // this token as its whole background and blurs its backdrop); the solid
  // info fill stays as the fallback and the color-safe accent for others.
  '--dsw-alias-button-info-bg': 'linear-gradient(135deg, rgba(110, 120, 255, 0.6), rgba(76, 94, 246, 0.38) 55%, rgba(139, 92, 246, 0.5))',
  '--dsw-alias-button-info-bg-hover': 'linear-gradient(135deg, rgba(126, 134, 255, 0.72), rgba(92, 110, 255, 0.46) 55%, rgba(150, 104, 255, 0.6))',
  // Liquid-glass button set (tech): translucent gradient fill with a slow
  // drift animation, a top inner highlight + 1px glass hairline + soft
  // blue-violet outer glow, and a press that eases the glow down and sinks
  // the button 1px. All effect tokens are inert in the base palettes, so
  // light/dark/aurora keep their capsule buttons.
  '--dsw-alias-button-radius': '10px',
  '--dsw-alias-button-radius-sm': '8px',
  '--dsw-alias-button-primary-bg': 'linear-gradient(135deg, rgba(122, 144, 255, 0.4), rgba(91, 106, 245, 0.2) 50%, rgba(139, 92, 246, 0.36))',
  '--dsw-alias-button-primary-bg-hover': 'linear-gradient(135deg, rgba(134, 156, 255, 0.5), rgba(104, 118, 255, 0.3) 50%, rgba(150, 104, 255, 0.44))',
  '--dsw-alias-button-primary-bg-size': '200% 100%',
  '--dsw-alias-button-primary-motion': 'dsh-button-drift 5s linear infinite',
  '--dsw-alias-button-glow':
    'inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 0 0 1px rgba(168, 190, 255, 0.3),'
    + '0 0 18px rgba(104, 118, 255, 0.45), 0 8px 28px rgba(91, 106, 245, 0.4)',
  '--dsw-alias-button-glow-hover':
    'inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 0 0 1px rgba(196, 210, 255, 0.45),'
    + '0 0 24px rgba(122, 144, 255, 0.6), 0 12px 36px rgba(104, 118, 255, 0.55)',
  '--dsw-alias-button-press-shadow':
    'inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 0 0 1px rgba(168, 190, 255, 0.18),'
    + '0 4px 12px rgba(91, 106, 245, 0.25)',
  '--dsw-alias-button-press-shift': 'translate(0, 1px)',
  '--dsw-alias-button-outline-glow':
    'inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 0 0 1px rgba(168, 190, 255, 0.32),'
    + '0 6px 18px rgba(91, 106, 245, 0.22)',
  '--dsw-alias-button-send-shift-active': 'translateY(-1px) translate(0, 2px)',
  '--dsw-alias-button-primary-dimmed': 'rgb(32, 36, 70)',
  '--dsw-alias-button-primary-fill': 'rgb(91, 106, 245)',
  '--dsw-alias-button-primary-hover': 'rgb(104, 118, 255)',
  '--dsw-alias-button-tool-bar-fill': 'rgba(33, 37, 68, 0.64)',
  '--dsw-alias-button-tool-bar-fill-invisible': 'rgba(31, 31, 31, 0.42)',
  '--dsw-alias-button-tool-bar-hover': 'rgba(33, 37, 68, 0.72)',
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
  // Code and inline-markup plates stay opaque: they sit inside the frosted
  // bubbles, and dense code needs a solid ground for readability.
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
  '--dsw-alias-toast-bg': 'rgba(47, 52, 96, 0.88)',
  '--dsw-alias-tooltip-bg': 'rgba(54, 60, 110, 0.9)',
  '--dsw-specific-bubble-highlight': 'rgba(43, 47, 88, 0.84)',
  '--dsw-specific-bubble': 'rgba(30, 34, 63, 0.78)',
  '--dsw-specific-input-major': 'rgba(20, 23, 44, 0.74)',
  '--dsw-specific-login-input': 'rgb(16, 18, 36)',
  '--dsw-specific-selector': 'rgba(28, 32, 59, 0.82)',
  // The sidebar sits over the app backdrop, so its fill is an indigo-tinted
  // acrylic (not near-black) that keeps the left aurora pool readable through
  // the frost; it carries no backdrop-filter (see AppFrame.module.css), so
  // the fill alone must hold the matte distance.
  '--dsw-specific-sidebar-fill': 'rgba(26, 30, 58, 0.62)',
  '--dsw-specific-sidebar-nav-item-active-accent': 'rgb(36, 40, 76)',
  '--dsw-specific-sidebar-nav-item-active': 'rgb(31, 34, 63)',
  '--dsw-specific-sidebar-nav-item-hover': 'rgb(26, 29, 54)',
  '--dsw-specific-tip': 'rgba(24, 27, 51, 0.8)',
})
