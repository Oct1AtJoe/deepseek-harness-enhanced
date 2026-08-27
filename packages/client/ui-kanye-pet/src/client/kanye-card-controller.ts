/** The kanye-pet card's form over the `kanye-pet` settings namespace. */

import type { SettingsScope, SettingsScopeSnapshot, SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'

/** Namespace of the kanye-pet capability (matches the host plugin). */
export const KANYE_NS = 'kanye-pet'

/** One character option from the manifest. */
export interface KanyeCharacterOption {
  id: string
  name: string
}

/** The pet fields this card edits — a subset of the served schema by design. */
export interface KanyeSettings {
  enabled?: boolean
  desktopPetEnabled?: boolean
  size?: number
  opacity?: number
  character?: string
}

/** One staged numeric field's draft state. */
export interface KanyeFieldState {
  text: string
  invalid: boolean
}

/** What the kanye-pet card renders. */
export interface KanyeCardState {
  available: boolean
  writable: boolean
  enabled: boolean
  desktopPetEnabled: boolean
  size: KanyeFieldState
  opacity: KanyeFieldState
  /** Current character id (from staged draft or stored value). */
  character: string
  /** Available character options from the manifest. */
  characters: KanyeCharacterOption[]
  /** Whether the manifest has loaded. */
  charactersLoaded: boolean
  dirty: boolean
  invalid: boolean
  saving: boolean
}

/** The registration-side face the kanye-pet card's slot entry injects. */
export interface KanyeCardFace {
  toggleEnabled: () => void
  toggleDesktopPet: () => void
  edit: (field: 'size' | 'opacity' | 'character', value: string) => void
  save: () => void
  discard: () => void
  hooks: {
    kanyeCard: SnapshotStore<KanyeCardState>
  }
}

interface StagedEdit { text: string }

/** Bridges the `kanye-pet` scope onto the card's staged form. */
export class KanyeCardController {
  private readonly staged = new Map<'size' | 'opacity', StagedEdit>()
  private readonly store: SnapshotStore<KanyeCardState>
  private saving = false
  private characters: KanyeCharacterOption[] = []
  private charactersLoaded = false

  constructor(private readonly scope: SettingsScope<KanyeSettings>) {
    this.store = createSnapshotStore(this.projection())
    scope.subscribe(() => { this.store.set(this.projection()) })
    void this.loadCharacters()
  }

  private async loadCharacters(): Promise<void> {
    try {
      const res = await fetch('/kanye-pet/assets/manifest.json')
      if (!res.ok) return
      const manifest: { characters: Record<string, { name?: string }> } = await res.json()
      this.characters = Object.entries(manifest.characters).map(([id, ch]) => ({ id, name: ch.name ?? id }))
    } catch {
      // manifest unreachable: character dropdown stays empty
    } finally {
      this.charactersLoaded = true
      this.store.set(this.projection())
    }
  }

  private snapshot(): SettingsScopeSnapshot<KanyeSettings> {
    return this.scope.getSnapshot()
  }

  private value(): KanyeSettings | undefined {
    return this.snapshot().value
  }

  private field(field: 'size' | 'opacity'): KanyeFieldState {
    const staged = this.staged.get(field)
    if (staged === undefined) {
      const value = this.value()?.[field]
      return { text: typeof value === 'number' ? String(value) : '', invalid: false }
    }
    const trimmed = staged.text.trim()
    if (trimmed === '' || !Number.isFinite(Number(trimmed))) return { text: staged.text, invalid: trimmed !== '' }
    const num = Number(trimmed)
    if (field === 'size' && (num < 100 || num > 300)) return { text: staged.text, invalid: true }
    if (field === 'opacity' && (num < 0 || num > 1)) return { text: staged.text, invalid: true }
    return { text: staged.text, invalid: false }
  }

  private projection(): KanyeCardState {
    const snapshot = this.snapshot()
    const value = this.value()
    const size = this.field('size')
    const opacity = this.field('opacity')
    const dirty = this.staged.size > 0
    return {
      available: snapshot.status === 'ready',
      writable: snapshot.writable,
      enabled: value?.enabled !== false,
      desktopPetEnabled: value?.desktopPetEnabled !== false,
      size,
      opacity,
      character: value?.character ?? 'kanye',
      characters: this.characters,
      charactersLoaded: this.charactersLoaded,
      dirty,
      invalid: (size.invalid || opacity.invalid) && dirty,
      saving: this.saving,
    }
  }

  /**
   * The face the card's slot entry injects from this controller.
   * @returns the registration-side face bridging the staged form onto the settings scope.
   */
  inject(): KanyeCardFace {
    return {
      toggleEnabled: () => {
        const next = this.value()?.enabled !== false ? false : true
        void this.scope.set('enabled', next)
      },
      toggleDesktopPet: () => {
        const next = this.value()?.desktopPetEnabled !== false ? false : true
        void this.scope.set('desktopPetEnabled', next)
      },
      edit: (field, text) => {
        if (field === 'character') {
          // character is not staged: write immediately
          void this.scope.set('character', text)
          return
        }
        this.staged.set(field, { text })
        this.store.set(this.projection())
      },
      save: () => {
        if (this.saving) return
        const size = this.staged.get('size')
        const opacity = this.staged.get('opacity')
        if (size === undefined && opacity === undefined) return
        const writes: Array<{ field: 'size' | 'opacity'; value: number }> = []
        for (const field of ['size', 'opacity'] as const) {
          const staged = this.staged.get(field)
          if (staged === undefined) continue
          const trimmed = staged.text.trim()
          if (trimmed === '') continue
          const parsed = Number(trimmed)
          if (!Number.isFinite(parsed)) return
          writes.push({ field, value: parsed })
        }
        if (writes.length === 0) return
        this.saving = true
        this.store.set(this.projection())
        void (async () => {
          for (const write of writes) await this.scope.set(write.field, write.value)
          this.saving = false
          this.staged.clear()
          this.store.set(this.projection())
        })()
      },
      discard: () => {
        this.staged.clear()
        this.store.set(this.projection())
      },
      hooks: { kanyeCard: this.store },
    }
  }
}
