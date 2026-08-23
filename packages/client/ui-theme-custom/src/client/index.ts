/**
 * Aurora and nebula tech themes, registered onto the official theme registry
 * (`ctx.theme.register`), plus their own settings row (`settings.general.item`
 * contribution) and the drift keyframes the nebula motion token references.
 * The registry snapshot drives the presenter; the row — registered beside the
 * official Appearance row, which stays light/dark/system only — carries the
 * two cubes so the official ui-theme package never references the custom ids.
 * Selection persists through the official settings scope because
 * `THEME_PREFERENCES` includes the ids; the keyframes ride a runtime style
 * element disposed with the fiber.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
import type { ThemeDefinition, ThemeSnapshot } from '@deepseek-ai/dsh-client-ui-theme/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale) and the
// settings section's SlotMap entry (ctx.slots.register for settings.general.item).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { AURORA_TOKENS } from './aurora.ts'
import { NEBULA_TOKENS } from './nebula.ts'
import { VOID_TOKENS } from './void.ts'
import { JADE_TOKENS } from './jade.ts'
import { SOLAR_TOKENS } from './solar.ts'
import { GLACIAL_TOKENS } from './glacial.ts'
import { en, zh, type TechThemeKey } from './locales.ts'
import { createTechThemeStore } from './settings-store.ts'
import { SETTINGS_NS, TechThemeRow, type TechThemeRowInjected } from './TechThemeRow.tsx'

export type { TechThemeRowInjected } from './TechThemeRow.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The tech-theme row's copy. */
    'settings.theme.custom': TechThemeKey
  }
}

/** Aurora: the violet variant — alias-token overrides over the dark base palette. */
const AURORA: ThemeDefinition = Object.freeze({
  id: 'aurora',
  colorScheme: 'dark' as const,
  tokens: AURORA_TOKENS,
})

/** Nebula: the deep-space tech variant — matte acrylic surfaces + gradient buttons. */
const NEBULA: ThemeDefinition = Object.freeze({
  id: 'nebula',
  colorScheme: 'dark' as const,
  tokens: NEBULA_TOKENS,
})

/** Void: the volcanic-ash dark variant — warm charcoal frosted glass. */
const VOID: ThemeDefinition = Object.freeze({
  id: 'void',
  colorScheme: 'dark' as const,
  tokens: VOID_TOKENS,
})

/** Jade: the emerald-green variant — deep forest-teal frosted glass. */
const JADE: ThemeDefinition = Object.freeze({
  id: 'jade',
  colorScheme: 'dark' as const,
  tokens: JADE_TOKENS,
})

/** Solar: the amber-orange variant — warm glowing frosted glass. */
const SOLAR: ThemeDefinition = Object.freeze({
  id: 'solar',
  colorScheme: 'dark' as const,
  tokens: SOLAR_TOKENS,
})

/** Glacial: the ice-blue variant — cold arctic frosted glass. */
const GLACIAL: ThemeDefinition = Object.freeze({
  id: 'glacial',
  colorScheme: 'dark' as const,
  tokens: GLACIAL_TOKENS,
})

/** Surface-glass CSS injected so sidebar, details, and bubbles get
 * backdrop-filter without modifying the host panel CSS (avoids
 * the fixed-positioned child constraint by using ::before pseudo-elements,
 * which are not DOM ancestors and therefore don't create a containing
 * block for position:fixed descendants).
 * Selectors use [class*="..."] to match CSS Modules hashed class names. */
const SURFACE_GLASS_CSS = `
/* Glass feel via translucent surfaces letting the aurora pools shine
   through — no backdrop-filter (it blurs the pools into invisibility).
   Panels keep their own rgba fills and the frame/root gradients show
   through the alpha, which is the DSH web glass recipe.
   better-sidebar's pane sits OUTSIDE the frame (x > frame width), so no
   frame pool shines behind it — give the pane its own soft light layer
   via ::after so the translucent fill has glass-like pools, matching
   the left sidebar. */
[class$="_pane"]{
  background-color:var(--dsw-specific-sidebar-fill) !important;
  position:relative;z-index:0;
}
[class$="_pane"]::after{
  content:'';position:absolute;inset:0;pointer-events:none;z-index:-1;
  background:
    radial-gradient(440px 320px at 82% 12%, rgba(228,222,238,0.18), transparent 56%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.05),inset 0 0 0 1px rgba(255,255,255,0.03);
}
`

/** localStorage key for the user's custom theme preference. */
const LS_KEY = 'dsh-theme-preference'

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
export const inject = ['theme', 'slots', 'locale']

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

/** Marker attribute for the injected surface-glass stylesheet. */
const SURFACE_GLASS_ATTRIBUTE = 'data-ui-theme-custom-surface-glass'

/**
 * Inject the surface-glass stylesheet once; idempotent across HMR re-applies.
 * Uses ::before pseudo-elements so backdrop-filter doesn't create a containing
 * block for position:fixed children (tooltips, dialogs).
 * @returns disposer removing the style element.
 */
function injectSurfaceGlass(): () => void {
  if (typeof document === 'undefined') return () => {}
  if (document.head.querySelector(`style[${SURFACE_GLASS_ATTRIBUTE}]`) !== null) return () => {}
  const tag = document.createElement('style')
  tag.setAttribute(SURFACE_GLASS_ATTRIBUTE, '')
  tag.textContent = SURFACE_GLASS_CSS
  document.head.appendChild(tag)
  return () => { tag.remove() }
}

/**
 * Client plugin body: register both themes and the drift keyframes, plus the
 * tech-theme row contribution, disposing everything with the fiber so HMR and
 * teardown never leave a stale theme, stylesheet, or row behind.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(SETTINGS_NS, { zh, en }), 'ui-theme-custom: row dictionaries')

  const store = createTechThemeStore()
  let bound: BoundActions<typeof store> | undefined
  const sync = (snapshot: ThemeSnapshot): void => {
    bound?.sync(snapshot.preference, snapshot.revision)
  }
  ctx.on('theme/change', sync)
  const injected = (actions: BoundActions<typeof store>): TechThemeRowInjected => {
    bound = actions
    sync(ctx.theme.getTheme())
    return {
      setTheme: (id) => {
        ctx.theme.setTheme(id)
        // Persist to localStorage so the boot script and next load
        // restore the same custom theme without flashing.
        try { localStorage.setItem(LS_KEY, id) } catch {}
      },
    }
  }
  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'appearance-custom',
    order: 20,
    store,
    locale: SETTINGS_NS,
    inject: injected,
  }, TechThemeRow))

  ctx.effect(() => {
    const disposeAurora = ctx.theme.register(AURORA)
    const disposeNebula = ctx.theme.register(NEBULA)
    const disposeVoid = ctx.theme.register(VOID)
    const disposeJade = ctx.theme.register(JADE)
    const disposeSolar = ctx.theme.register(SOLAR)
    const disposeGlacial = ctx.theme.register(GLACIAL)
    const removeKeyframes = injectButtonDrift()
    const removeSurfaceGlass = injectSurfaceGlass()
    return () => {
      disposeAurora()
      disposeNebula()
      disposeVoid()
      disposeJade()
      disposeSolar()
      disposeGlacial()
      removeKeyframes()
      removeSurfaceGlass()
    }
  }, 'ui-theme-custom: tech theme registrations + drift keyframes + surface glass')

  // Restore the user's saved custom theme preference now that themes are
  // registered. Runs during apply() (before first React render when
  // "immediately" is true), so the first paint already shows the right
  // theme — no flash.
  try {
    const saved = typeof localStorage !== 'undefined' && localStorage.getItem(LS_KEY)
    if (saved && saved !== 'light' && saved !== 'dark' && saved !== 'system'
      && ctx.theme.getTheme().preference !== saved) {
      ctx.theme.setTheme(saved)
    }
  } catch { /* localStorage unavailable */ }
}
