// @vitest-environment jsdom
import { Context, Service } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject, NS } from '../src/client/index.ts'
import { SubagentsSettingsTab } from '../src/client/SubagentsSettingsTab.tsx'
import type { SubagentsSettingsTabInjected } from '../src/client/SubagentsSettingsTab.tsx'

usePinnedBrowserLanguages('zh-CN')
afterEach(cleanup)

const EMPTY = { backends: [], tools: [] }
type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  class RemoteService extends Service {
    constructor(serviceCtx: Context) {
      super(serviceCtx, 'remote')
    }
  }
  new RemoteService(ctx)
  const list = vi.fn<() => Promise<Result<typeof EMPTY>>>()
    .mockResolvedValue({ ok: true, value: EMPTY })
  const install = vi.fn<() => Promise<Result<{ accepted: true }>>>()
    .mockResolvedValue({ ok: true, value: { accepted: true } })
  const remove = vi.fn<() => Promise<Result<{ accepted: true }>>>()
    .mockResolvedValue({ ok: true, value: { accepted: true } })
  const updateConfig = vi.fn<() => Promise<Result<{ accepted: true }>>>()
    .mockResolvedValue({ ok: true, value: { accepted: true } })
  ctx.provide('remote.subagentManager', { list, installBackend: install, removeBackend: remove, updateConfig })
  return { ctx, slots: ctx.get('slots') as SlotRegistry, locale, list, install, remove, updateConfig }
}

function declare(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: { 'settings.plugins.tab': { kind: 'list', scope: 'root' } },
  } as never, () => null)
}

describe('ui-settings-subagents browser plugin', () => {
  it('declares only the services used by the Settings Remote contribution', () => {
    expect(inject).toEqual(['slots', 'locale', 'remote', 'remote.subagentManager'])
  })

  it('registers a localized tab without reading the Remote eagerly', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()

    const entry = b.slots.entries('settings.plugins.tab')[0]!
    expect(entry.component).toBe(SubagentsSettingsTab)
    expect(entry.options).toMatchObject({ id: 'subagents', order: 30 })
    expect(entry.locale).toBe(NS)
    expect(resolveSlotLabel(entry.options.label)).toBe('子智能体')
    expect(b.list).not.toHaveBeenCalled()

    const injected = (entry.inject as unknown as () => SubagentsSettingsTabInjected)()
    await expect(injected.list()).resolves.toEqual(EMPTY)
    expect(b.list).toHaveBeenCalledTimes(1)
    const request = { moduleName: '@deepseek-ai/dsh-subagent-acp', providerName: 'acp', config: { providerName: 'acp' } }
    await expect(injected.install(request)).resolves.toBeUndefined()
    expect(b.install).toHaveBeenCalledWith(request)
    await expect(injected.remove({ entryId: 'row-1' })).resolves.toBeUndefined()
    expect(b.remove).toHaveBeenCalledWith({ entryId: 'row-1' })
    await expect(injected.updateConfig({ entryId: 'row-1', config: { providerName: 'acp' } })).resolves.toBeUndefined()
    expect(b.updateConfig).toHaveBeenCalledWith({ entryId: 'row-1', config: { providerName: 'acp' } })
    b.list.mockResolvedValueOnce({ ok: false, error: { code: 'REMOTE_ERROR', message: 'unavailable' } })
    await expect(injected.list()).rejects.toThrow('subagentManager.list failed: REMOTE_ERROR: unavailable')
    await b.ctx.fiber.dispose()
  })

  it('follows locale and recovers across late declaration and declarer reload', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(b.slots.entries('settings.plugins.tab')).toHaveLength(0)

    const stop = declare(b.slots)
    await vi.waitFor(() => { expect(b.slots.entries('settings.plugins.tab')).toHaveLength(1) })
    b.locale.setLocale('en')
    expect(resolveSlotLabel(b.slots.entries('settings.plugins.tab')[0]!.options.label)).toBe('Subagents')

    stop()
    expect(b.slots.entries('settings.plugins.tab')).toHaveLength(0)
    declare(b.slots)
    await vi.waitFor(() => {
      expect(b.slots.entries('settings.plugins.tab')[0]?.component).toBe(SubagentsSettingsTab)
    })

    await fiber.dispose()
    expect(b.slots.entries('settings.plugins.tab')).toHaveLength(0)
    expect(() => b.locale.register(NS, 'zh', {})).not.toThrow()
    await b.ctx.fiber.dispose()
  })
})
