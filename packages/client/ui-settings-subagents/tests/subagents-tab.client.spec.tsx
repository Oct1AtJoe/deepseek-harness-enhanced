// @vitest-environment jsdom
/** SubagentsSettingsTab behavior: backend directory, install/remove/reconfigure, and failure states. */
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { SubagentBackendEntry, SubagentBackendSnapshot, SubagentToolEntry } from '@deepseek-ai/dsh-api-remotes/client'
import { SubagentsSettingsTab, type SubagentsSettingsTabInjected } from '../src/client/SubagentsSettingsTab.tsx'
import type { SubagentsSettingsTabProps } from '../src/client/SubagentsSettingsTab.tsx'

afterEach(cleanup)

/** The callable mocks the tab receives; the type keeps `.mock.calls` usable. */
interface MountedMocks {
  list: Mock
  install: Mock
  remove: Mock
  updateConfig: Mock
}

const COPY: Record<string, string> = {
  intro: '管理此 dsh 安装的子智能体后端。',
  loading: '正在读取目录…',
  failed: '目录读取失败。',
  retry: '重试',
  refresh: '刷新',
  installedSection: '已安装',
  candidatesSection: '可安装',
  toolsSection: '子智能体工具',
  noTools: '没有具名子智能体工具。',
  toolModeOneShot: '一次性',
  toolModeContinuable: '可继续',
  sourceBuiltin: '内置',
  sourceUser: '用户配置',
  enabled: '已启用',
  disabled: '已停用',
  notInstalled: '未安装',
  capOutputSchema: '结构化输出',
  capPersona: '人设',
  noConfig: '无配置',
  actionInstall: '安装',
  actionEdit: '编辑配置',
  actionRemove: '移除',
  actionConfirmRemove: '确认移除？',
  actionSave: '保存',
  actionCancel: '取消',
  removing: '移除中…',
  configInvalid: '配置必须是 JSON 对象。',
  opFailed: '操作失败：',
}

function backend(over: Partial<SubagentBackendEntry> & { moduleName: string; providerName: string }): SubagentBackendEntry {
  return {
    entryId: over.moduleName,
    installed: true,
    enabled: true,
    source: 'bundle',
    ...over,
  }
}

const SPAWN = backend({
  entryId: 'subagent-spawn-in-process',
  moduleName: '@deepseek-ai/dsh-subagent-spawn-in-process',
  providerName: 'spawn',
  capabilities: { outputSchema: true, depthLimit: false, toolFilter: false, persona: true },
  config: { providerName: 'spawn' },
})
const ACP = backend({
  entryId: '@deepseek-ai/dsh-subagent-acp',
  moduleName: '@deepseek-ai/dsh-subagent-acp',
  providerName: 'acp',
  installed: false,
  enabled: false,
})

const VISION: SubagentToolEntry = {
  entryId: 'tool-subagent-vision',
  toolName: 'subagent_vision',
  provider: 'spawn',
  model: 'mimo-v2.5',
  backgroundMode: 'one-shot',
  enabled: true,
  source: 'user',
  config: { provider: 'spawn', toolName: 'subagent_vision', agentOptions: { provider: 'xiaomi', model: 'mimo-v2.5' } },
}

function snapshot(backends: SubagentBackendEntry[], tools: SubagentToolEntry[] = []): SubagentBackendSnapshot {
  return { backends, tools }
}

function mount(over: Partial<SubagentsSettingsTabInjected> = {}): MountedMocks {
  const list = vi.fn().mockResolvedValue(snapshot([SPAWN, ACP]))
  const install = vi.fn().mockResolvedValue(undefined)
  const remove = vi.fn().mockResolvedValue(undefined)
  const updateConfig = vi.fn().mockResolvedValue(undefined)
  const injected = { list, install, remove, updateConfig, ...over }
  const props: SubagentsSettingsTabProps = {
    useSessions: (() => undefined) as never,
    useWorkspaces: (() => undefined) as never,
    ...injected,
    t: (key: string) => COPY[key] ?? key,
  }
  render(<SubagentsSettingsTab {...props} />)
  return injected as unknown as MountedMocks
}

describe('SubagentsSettingsTab', () => {
  it('renders named subagent tools with provider, model, and mode badges', async () => {
    mount({ list: vi.fn().mockResolvedValue(snapshot([SPAWN, ACP], [VISION])) })
    expect(await screen.findByText('subagent_vision')).toBeDefined()
    expect(screen.getByText('子智能体工具')).toBeDefined()
    // 'spawn' appears on the backend card and the tool's provider badge.
    expect(screen.getAllByText('spawn').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('mimo-v2.5')).toBeDefined()
    expect(screen.getByText('一次性')).toBeDefined()
    expect(screen.getByText('用户配置')).toBeDefined()
    // '已启用' appears on the spawn backend card and the tool card.
    expect(screen.getAllByText('已启用').length).toBeGreaterThanOrEqual(2)
  })

  it('reconfigures a named tool through the JSON editor', async () => {
    const { updateConfig, list } = mount({ list: vi.fn().mockResolvedValue(snapshot([SPAWN, ACP], [VISION])) })
    await screen.findByText('subagent_vision')
    const toolCard = screen.getByText('subagent_vision').closest('li') as HTMLElement
    fireEvent.click(within(toolCard).getByRole('button', { name: '编辑配置' }))
    const editor = within(toolCard).getByRole('textbox') as HTMLTextAreaElement
    expect(editor.value).toContain('"toolName": "subagent_vision"')
    fireEvent.change(editor, { target: { value: '{ "provider": "spawn", "toolName": "subagent_vision", "backgroundMode": "continuable" }' } })
    fireEvent.click(within(toolCard).getByRole('button', { name: '保存' }))
    await waitFor(() => {
      expect(updateConfig).toHaveBeenCalledWith({
        entryId: 'tool-subagent-vision',
        config: { provider: 'spawn', toolName: 'subagent_vision', backgroundMode: 'continuable' },
      })
    })
    await waitFor(() => { expect(list.mock.calls.length).toBeGreaterThanOrEqual(2) })
  })

  it('removes a named tool after a two-step confirmation', async () => {
    const { remove } = mount({ list: vi.fn().mockResolvedValue(snapshot([SPAWN, ACP], [VISION])) })
    await screen.findByText('subagent_vision')
    const toolCard = screen.getByText('subagent_vision').closest('li') as HTMLElement
    fireEvent.click(within(toolCard).getByRole('button', { name: '移除' }))
    expect(within(toolCard).getByRole('button', { name: '确认移除？' })).toBeDefined()
    fireEvent.click(within(toolCard).getByRole('button', { name: '确认移除？' }))
    await waitFor(() => {
      expect(remove).toHaveBeenCalledWith({ entryId: 'tool-subagent-vision' })
    })
  })

  it('renders installed backends and installable candidates with badges', async () => {
    mount()
    expect(await screen.findByText('spawn')).toBeDefined()
    expect(screen.getByText('acp')).toBeDefined()
    expect(screen.getByText('已安装')).toBeDefined()
    expect(screen.getByText('可安装')).toBeDefined()
    expect(screen.getByText('内置')).toBeDefined()
    expect(screen.getByText('已启用')).toBeDefined()
    expect(screen.getByText('未安装')).toBeDefined()
    // Only the true capability chips render.
    expect(screen.getByText('结构化输出')).toBeDefined()
    expect(screen.getByText('人设')).toBeDefined()
    expect(screen.queryByText('深度限制')).toBeNull()
  })

  it('reconfigures a backend through the JSON editor', async () => {
    const { updateConfig, list } = mount()
    await screen.findByText('spawn')
    fireEvent.click(screen.getByRole('button', { name: '编辑配置' }))
    const editor = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(editor.value).toContain('"providerName": "spawn"')
    fireEvent.change(editor, { target: { value: '{ "providerName": "spawn", "timeoutMs": 9000 }' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => {
      expect(updateConfig).toHaveBeenCalledWith({
        entryId: 'subagent-spawn-in-process',
        config: { providerName: 'spawn', timeoutMs: 9000 },
      })
    })
    // The catalog is re-read after a successful write.
    await waitFor(() => { expect(list.mock.calls.length).toBeGreaterThanOrEqual(2) })
  })

  it('rejects a malformed config without calling the Remote', async () => {
    const { updateConfig } = mount()
    await screen.findByText('spawn')
    fireEvent.click(screen.getByRole('button', { name: '编辑配置' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'not json' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('配置必须是 JSON 对象。')
    expect(updateConfig).not.toHaveBeenCalled()
  })

  it('installs a candidate backend with the prefilled provider config', async () => {
    const { install } = mount()
    await screen.findByText('acp')
    fireEvent.click(screen.getByRole('button', { name: '安装' }))
    const editor = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(editor.value).toContain('"providerName": "acp"')
    // The editor's save button carries the same Install label.
    fireEvent.click(screen.getByRole('button', { name: '安装' }))
    await waitFor(() => {
      expect(install).toHaveBeenCalledWith({
        moduleName: '@deepseek-ai/dsh-subagent-acp',
        providerName: 'acp',
        config: { providerName: 'acp' },
      })
    })
  })

  it('removes a backend after a two-step confirmation', async () => {
    const { remove } = mount()
    await screen.findByText('spawn')
    fireEvent.click(screen.getByRole('button', { name: '移除' }))
    expect(screen.getByRole('button', { name: '确认移除？' })).toBeDefined()
    expect(remove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认移除？' }))
    await waitFor(() => {
      expect(remove).toHaveBeenCalledWith({ entryId: 'subagent-spawn-in-process' })
    })
  })

  it('surfaces an operation failure banner', async () => {
    mount({
      remove: vi.fn().mockRejectedValue(new Error('refused')),
    })
    await screen.findByText('spawn')
    fireEvent.click(screen.getByRole('button', { name: '移除' }))
    fireEvent.click(screen.getByRole('button', { name: '确认移除？' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('操作失败：refused')
  })

  it('shows the failure view with a working retry when the catalog read fails', async () => {
    const list = vi.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(snapshot([SPAWN]))
    mount({ list })
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('目录读取失败。boom')
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(await screen.findByText('spawn')).toBeDefined()
  })
})
