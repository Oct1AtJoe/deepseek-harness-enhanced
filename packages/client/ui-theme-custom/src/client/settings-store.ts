/**
 * Tech-theme row slot store: a mirror of the theme service snapshot, exactly
 * like the official Appearance row's store. The plugin's apply-world change
 * listener is the only writer; the row component reads via props.useStore.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import type { ThemePreference } from '@deepseek-ai/dsh-client-ui-theme/client'

/** Store state mirrored from the theme snapshot. */
export interface TechThemeRowState {
  /** Persisted preference (selection state reads this, never the resolved active theme). */
  preference: ThemePreference
  /** Service revision; -1 until first sync so revision 0 lands as a change. */
  revision: number
}

/** Declared action shape giving the exported factory a stable return type. */
type TechThemeRowActions = {
  sync: (draft: TechThemeRowState, preference: ThemePreference, revision: number) => void
}

/**
 * Declares the tech-theme row state and write surface.
 * @returns the store handle.
 */
export function createTechThemeStore(): EngineStoreHandle<TechThemeRowState, TechThemeRowActions> {
  return defineStore({
    init: (): TechThemeRowState => ({ preference: 'system', revision: -1 }),
    actions: {
      sync: (d, preference: ThemePreference, revision: number) => {
        if (revision <= d.revision) return
        d.preference = preference
        d.revision = revision
      },
    },
  })
}
