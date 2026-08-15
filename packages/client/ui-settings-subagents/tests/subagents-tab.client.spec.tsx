// @vitest-environment jsdom
/** SubagentsSettingsTab behavior: roster assembly, open/stop actions, empty state, and auto-pull. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createSnapshotStore, type SessionId, type SessionListState, type SessionSummary, type SubagentAddress } from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import { SubagentsSettingsTab } from '../src/client/SubagentsSettingsTab.tsx'
import type { SubagentsSettingsTabProps } from '../src/client/SubagentsSettingsTab.tsx'

afterEach(cleanup)

const COPY: Record<string, string> = {
  intro: '跨会话查看与管理的子智能体列表。',
  empty: '暂无子智能体。',
  emptyDetail: '会话中委派的子智能体会出现在这里。',
  refresh: '刷新',
  running: '运行中',
  idle: '空闲',
  modeContinuable: '可继续',
  modeOneShot: '一次性',
  actionOpen: '打开',
  actionStop: '停止',
  stopping: '停止中…',
  stopFailed: '停止失败，请重试。',
  unhealthy: '不可用',
}

const sid = (id: string): SessionId => id as SessionId
const PARENT = sid('parent-1')
const CHILD = sid('child-1')
const OTHER = sid('child-2')

function summary(over: Partial<SessionSummary> & { id: string }): SessionSummary {
  return { displayTitle: over.id, running: false, updatedAt: 0, ...over } as SessionSummary
}

function state(over: Partial<SessionListState> = {}): SessionListState {
  return {
    ids: [PARENT, CHILD, OTHER],
    byId: {
      [PARENT]: summary({ id: PARENT, displayTitle: 'Parent' }),
      [CHILD]: summary({ id: CHILD, parentId: PARENT, displayTitle: 'worker', origin: 'subagent', running: true }),
      [OTHER]: summary({ id: OTHER, parentId: PARENT, displayTitle: 'reviewer', origin: 'subagent', running: false }),
    },
    current: undefined,
    phase: 'ready',
    subagentsByParent: {
      [PARENT]: {
        entries: [
          { kind: 'child', id: CHILD, mode: 'continuable', label: 'worker', activity: 'running', hasChildren: false },
          { kind: 'child', id: OTHER, mode: 'one-shot', label: 'reviewer', activity: 'inactive', hasChildren: false },
          { kind: 'diagnostic', id: sid('bad-1'), reason: 'corrupt' },
        ],
        parentAvailable: true,
        state: 'ready',
        error: null,
      },
    },
    jobsBySession: {},
    currentAddress: undefined,
    ...over,
  }
}

function mount(over: Partial<SessionListState> = {}, actions: Partial<SubagentsSettingsTabProps> = {}) {
  const store = createSnapshotStore<SessionListState>(state(over))
  const open = vi.fn()
  const refresh = vi.fn()
  const stop = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
  const props: SubagentsSettingsTabProps = {
    useSessions: bindSnapshotSelector(store),
    useWorkspaces: (() => undefined) as never,
    open,
    refresh,
    stop,
    t: (key: string) => COPY[key] ?? key,
    ...actions,
  }
  render(<SubagentsSettingsTab {...props} />)
  return { store, ...props }
}

describe('SubagentsSettingsTab', () => {
  it('flattens catalogs into a roster with running rows first and mode tags', async () => {
    mount()
    const rows = await screen.findAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(screen.getByText('worker')).toBeDefined()
    expect(screen.getByText('reviewer')).toBeDefined()
    expect(screen.getByText('可继续')).toBeDefined()
    expect(screen.getByText('一次性')).toBeDefined()
    // Running row sorts first: worker is continuable/running, reviewer one-shot/idle.
    expect(rows[0]?.textContent).toContain('worker')
    expect(screen.getByRole('img', { name: '运行中' })).toBeDefined()
    expect(screen.getByRole('img', { name: '空闲' })).toBeDefined()
  })

  it('opens a child transcript through the injected open action', async () => {
    const { open } = mount()
    await screen.findAllByRole('listitem')
    const expected: SubagentAddress = { parentSessionId: PARENT, childSessionId: CHILD, mode: 'continuable' }
    fireEvent.click(screen.getAllByRole('button', { name: '打开' })[0]!)
    expect(open).toHaveBeenCalledWith(expected)
  })

  it('stops only running continuable children and surfaces failures', async () => {
    const { stop } = mount({}, {
      stop: vi.fn<() => Promise<void>>().mockRejectedValue(new Error('refused')),
    })
    await screen.findAllByRole('listitem')
    // Only the running continuable row carries a Stop button.
    expect(screen.getAllByRole('button', { name: '停止' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '停止' }))
    await waitFor(() => {
      expect(stop).toHaveBeenCalledWith({ parentSessionId: PARENT, childSessionId: CHILD, mode: 'continuable' })
    })
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('停止失败')
  })

  it('shows the empty state when no catalogs exist', async () => {
    mount({ subagentsByParent: {} })
    expect(await screen.findByText('暂无子智能体。')).toBeDefined()
  })

  it('auto-pulls a catalog once for each parent summaries claim', () => {
    const { refresh } = mount()
    expect(refresh).toHaveBeenCalledWith(PARENT)
  })
})
