/**
 * Aurora and nebula tech themes, registered onto the official theme registry
 * (`ctx.theme.register`). The registry snapshot drives the Appearance row
 * cubes and the presenter; the definitions here carry the full token sets —
 * aurora's violet palette, nebula's liquid-glass surfaces, gradient/glow
 * buttons, and the drift motion — while the official ui-theme package stays
 * upstream. The package also ships the button-drift keyframes the nebula
 * motion token references, injected with the client bundle.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { ThemeDefinition } from '@deepseek-ai/dsh-client-ui-theme/client'
import '../styles/theme-extras.css'
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

/** Required services (cordis fiber inject — the loader passes all module exports as an object plugin). */
export const inject = ['theme']

/**
 * Client plugin body: register both themes for the session, disposing with
 * the fiber so HMR and teardown never leave a stale theme selectable.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => {
    const disposeAurora = ctx.theme.register(AURORA)
    const disposeNebula = ctx.theme.register(NEBULA)
    return () => {
      disposeAurora()
      disposeNebula()
    }
  }, 'ui-theme-custom: tech theme registrations')
}
