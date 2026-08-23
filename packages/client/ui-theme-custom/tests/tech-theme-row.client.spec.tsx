// @vitest-environment jsdom
/** TechThemeRow behavior: two cubes, selection follows the persisted
 * preference, clicks drive setTheme. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createSnapshotStore, type SessionListState, type WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import { TechThemeRow, type TechThemeRowProps } from '../src/client/TechThemeRow.tsx'
import { createTechThemeStore } from '../src/client/settings-store.ts'
import type { ThemePreference } from '@deepseek-ai/dsh-client-ui-theme/client'

afterEach(cleanup)

const COPY: Record<string, string> = {
  'tech-theme.title': 'Tech themes',
  'tech-theme.aurora': 'Aurora',
  'tech-theme.nebula': 'Nebula',
}

/** Empty global standard-kit hooks (the row reads neither). */
function emptySessions() {
  const store = createSnapshotStore<SessionListState>(
    { ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined })
  return bindSnapshotSelector(store)
}
function emptyWorkspaces() {
  const store = createSnapshotStore<WorkspaceListState>({
    items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: undefined,
  })
  return bindSnapshotSelector(store)
}

function mount(preference: ThemePreference = 'system') {
  // Real store instance — the sanctioned zero-machinery path for tests.
  const store = createTechThemeStore().create()
  store.actions.sync(preference, 0)
  const setTheme = vi.fn()
  const props: TechThemeRowProps = {
    useSessions: emptySessions(),
    useWorkspaces: emptyWorkspaces(),
    useStore: bindSnapshotSelector(store),
    actions: store.actions,
    t: (key: string) => COPY[key] ?? key,
    setTheme,
  }
  render(<TechThemeRow {...props} />)
  return { store, setTheme }
}

const pressed = (name: RegExp): string | null =>
  screen.getByRole('button', { name }).getAttribute('aria-pressed')

describe('TechThemeRow', () => {
  it('renders the title and two cubes with the persisted cube selected', () => {
    mount('nebula' as ThemePreference)
    expect(screen.getByText('Tech themes')).toBeDefined()
    expect(pressed(/Nebula/)).toBe('true')
    expect(pressed(/Aurora/)).toBe('false')
  })

  it('leaves both cubes unselected for an official preference', () => {
    mount('dark')
    expect(pressed(/Aurora/)).toBe('false')
    expect(pressed(/Nebula/)).toBe('false')
  })

  it('cube clicks drive setTheme with the theme id', () => {
    const b = mount('system')
    fireEvent.click(screen.getByRole('button', { name: /Aurora/ }))
    expect(b.setTheme).toHaveBeenCalledWith('aurora')
    fireEvent.click(screen.getByRole('button', { name: /Nebula/ }))
    expect(b.setTheme).toHaveBeenCalledWith('nebula')
  })

  it('selection follows the store mirror, not the click echo', () => {
    const b = mount('system')
    act(() => { b.store.actions.sync('aurora' as ThemePreference, 1) })
    expect(pressed(/Aurora/)).toBe('true')
    expect(pressed(/Nebula/)).toBe('false')
  })
})
