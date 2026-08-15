// @vitest-environment jsdom
/** SkillsSettingsTab behavior: search, body disclosure, invocation switches, and failure feedback. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createSnapshotStore, type SessionListState, type WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import type {
  SkillDefinitionView,
  SkillManagerEntry,
  SkillManagerSnapshot,
} from '@deepseek-ai/dsh-api-remotes/client'
import { SkillsSettingsTab } from '../src/client/SkillsSettingsTab.tsx'
import type { SkillsSettingsTabProps } from '../src/client/SkillsSettingsTab.tsx'

afterEach(cleanup)

const COPY: Record<string, string> = {
  loading: '正在读取技能…',
  error: '暂时无法读取技能。',
  retry: '重试',
  search: '搜索技能',
  catalog: '技能列表',
  empty: '暂无技能。',
  emptySearch: '没有匹配的技能。',
  noSession: '请先打开一个会话；技能列表按当前会话展示。',
  modelInvocable: '模型可调用',
  userInvocable: '用户可调用',
  failed: '设置失败，请重试。',
  detailSource: '来源',
  detailProvider: '提供方',
  detailPath: '路径',
  detailContent: '正文',
  contentLoading: '正在读取正文…',
  contentFailed: '正文读取失败。',
}

const DEMO: SkillManagerEntry = {
  name: 'demo-skill',
  description: 'Demo skill',
  source: 'bundled',
  provider: 'filesystem',
  invocation: { modelInvocable: true, userInvocable: true },
}
const USER_ONLY: SkillManagerEntry = {
  name: 'user-only',
  description: 'User-only skill',
  source: 'user-dsh',
  provider: 'filesystem',
  invocation: { modelInvocable: false, userInvocable: true },
}

const DEFINITION: SkillDefinitionView = {
  ...DEMO,
  path: '/skills/demo.md',
  content: 'Demo body line one.\n\nDemo body line two.',
}

function emptySessions(current: string | null = 'session-1') {
  const sessionId: string | undefined = current === null ? undefined : current
  const store = createSnapshotStore<SessionListState>(
    { ids: sessionId === undefined ? [] : [sessionId as never], byId: {}, current: sessionId as never, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined })
  return bindSnapshotSelector(store)
}
function emptyWorkspaces() {
  const store = createSnapshotStore<WorkspaceListState>({
    items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: undefined,
  })
  return bindSnapshotSelector(store)
}

const SESSION = 'session-1'

function mount(snapshot: SkillManagerSnapshot, over: Partial<SkillsSettingsTabProps> = {}) {
  const list = vi.fn<() => Promise<SkillManagerSnapshot>>().mockResolvedValue(snapshot)
  const get = vi.fn<() => Promise<SkillDefinitionView>>().mockResolvedValue(DEFINITION)
  const setInvocation = vi.fn<() => Promise<{ accepted: true }>>().mockResolvedValue({ accepted: true })
  const props: SkillsSettingsTabProps = {
    useSessions: emptySessions(),
    useWorkspaces: emptyWorkspaces(),
    list,
    get,
    setInvocation,
    t: (key: string) => COPY[key] ?? key,
    ...over,
  }
  render(<SkillsSettingsTab {...props} />)
  return props
}

const switchOf = (label: RegExp): HTMLButtonElement =>
  screen.getByRole('switch', { name: label }) as HTMLButtonElement

describe('SkillsSettingsTab', () => {
  it('lists skills with effective invocation switches and a live count', async () => {
    mount({ skills: [DEMO, USER_ONLY] })
    expect(await screen.findByText('demo-skill')).toBeDefined()
    expect(screen.getByText('user-only')).toBeDefined()
    expect(screen.getByText('Demo skill')).toBeDefined()
    expect(screen.getByText('User-only skill')).toBeDefined()
    expect(screen.getByText('2')).toBeDefined()
    expect(switchOf(/模型可调用 demo-skill/).getAttribute('aria-checked')).toBe('true')
    expect(switchOf(/用户可调用 user-only/).getAttribute('aria-checked')).toBe('true')
    expect(switchOf(/模型可调用 user-only/).getAttribute('aria-checked')).toBe('false')
  })

  it('filters the catalog by query', async () => {
    mount({ skills: [DEMO, USER_ONLY] })
    await screen.findByText('demo-skill')
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'user' } })
    expect(screen.queryByText('demo-skill')).toBeNull()
    expect(screen.getByText('user-only')).toBeDefined()
    expect(screen.getByText('1')).toBeDefined()
  })

  it('loads and shows the body on disclosure, with source, provider, and path', async () => {
    const { get } = mount({ skills: [DEMO, USER_ONLY] })
    await screen.findByText('demo-skill')
    fireEvent.click(screen.getByRole('button', { name: /^demo-skill/ }))
    expect(await screen.findByText(/Demo body line one\./)).toBeDefined()
    expect(screen.getByText(/Demo body line two\./)).toBeDefined()
    expect(screen.getByText('bundled')).toBeDefined()
    expect(screen.getByText('filesystem')).toBeDefined()
    expect(screen.getByText('/skills/demo.md')).toBeDefined()
    expect(get).toHaveBeenCalledWith(SESSION, 'demo-skill')
  })

  it('writes a switch flip through setInvocation and refreshes the catalog', async () => {
    const { setInvocation, list } = mount({ skills: [DEMO, USER_ONLY] })
    await screen.findByText('user-only')
    const model = switchOf(/模型可调用 user-only/)
    expect(model.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(model)
    await waitFor(() => {
      expect(setInvocation).toHaveBeenCalledWith({
        name: 'user-only',
        invocation: { modelInvocable: true, userInvocable: true },
      })
    })
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('surfaces a failed write without refreshing', async () => {
    const { list } = mount({ skills: [DEMO, USER_ONLY] }, {
      setInvocation: vi.fn<() => Promise<{ accepted: true }>>()
        .mockRejectedValue(new Error('write refused')),
    })
    await screen.findByText('user-only')
    fireEvent.click(switchOf(/用户可调用 user-only/))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('设置失败，请重试。')
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('recovers from a catalog read failure', async () => {
    const { list } = mount({ skills: [] }, {
      list: vi.fn<() => Promise<SkillManagerSnapshot>>()
        .mockRejectedValueOnce(new Error('unavailable'))
        .mockResolvedValue({ skills: [DEMO] }),
    })
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('暂时无法读取技能。')
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(await screen.findByText('demo-skill')).toBeDefined()
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('shows a hint and skips the Remote when no session is open', async () => {
    const { list } = mount({ skills: [DEMO] }, { useSessions: emptySessions(null) })
    expect(await screen.findByText('请先打开一个会话；技能列表按当前会话展示。')).toBeDefined()
    expect(list).not.toHaveBeenCalled()
  })
})
