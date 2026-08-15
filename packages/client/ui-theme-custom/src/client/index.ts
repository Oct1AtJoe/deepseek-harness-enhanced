/**
 * Aurora and nebula tech themes, registered onto the official theme registry
 * (`ctx.theme.register`). The registry snapshot drives the Appearance row
 * cubes and the presenter; the definitions here carry the full token sets —
 * aurora's violet palette, nebula's liquid-glass surfaces, gradient/glow
 * buttons, and the drift motion — while the official ui-theme package stays
 * upstream. The plugin also injects the button-drift keyframes the nebula
 * motion token references as a runtime style element (the same mechanism the
 * client bundle uses for CSS modules), so the motion works without touching
 * the official stylesheets.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { ThemeDefinition } from '@deepseek-ai/dsh-client-ui-theme/client'
import { AURORA_TOKENS } from './aurora.ts'
import { NEBULA_TOKENS } from './nebula.ts'

/** Aurora: the violet variant — alias-token overrides over the dark base palette. */
const AURORA: ThemeDefinition = Object.freeze({
  id: 'aurora',
  colorScheme: 'dark' as const,
  tokens: AURORA_TOKENS,
})

/** Nebula: the deep-space tech variant — liquid-glass surfaces + gradient buttons. */
const NEBULA: ThemeDefinition = Object.freeze({
  id: 'nebula',
  colorScheme: 'dark' as const,
  tokens: NEBULA_TOKENS,
})

/** Stable marker attribute for the injected keyframes style. */
const KEYFRAMES_ATTRIBUTE = 'data-ui-theme-custom-keyframes'

/** Button-drift keyframes the nebula motion token references. */
const BUTTON_DRIFT_CSS = `@keyframes dsh-button-drift {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}`

/** Required services (cordis fiber inject — the loader passes all module exports as an object plugin). */
export const inject = ['theme']

/**
 * Inject the keyframes style once; idempotent across HMR re-applies.
 * @returns disposer removing the style element.
 */
function injectButtonDrift(): () => void {
  if (typeof document === 'undefined') return () => {}
  if (document.head.querySelector(`style[${KEYFRAMES_ATTRIBUTE}]`) !== null) return () => {}
  const tag = document.createElement('style')
  tag.setAttribute(KEYFRAMES_ATTRIBUTE, '')
  tag.textContent = BUTTON_DRIFT_CSS
  document.head.appendChild(tag)
  return () => { tag.remove() }
}

/**
 * Client plugin body: register both themes for the session and inject the
 * drift keyframes, disposing with the fiber so HMR and teardown never leave a
 * stale theme selectable or a dead stylesheet behind.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => {
    const disposeAurora = ctx.theme.register(AURORA)
    const disposeNebula = ctx.theme.register(NEBULA)
    const removeKeyframes = injectButtonDrift()
    return () => {
      disposeAurora()
      disposeNebula()
      removeKeyframes()
    }
  }, 'ui-theme-custom: tech theme registrations + drift keyframes')
}
