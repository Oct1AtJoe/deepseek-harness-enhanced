// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionId, SubagentAddress } from '@deepseek-ai/dsh-client-runtime/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject, NS } from '../src/client/index.ts'
import { SubagentsSettingsTab } from '../src/client/SubagentsSettingsTab.tsx'
import type { SubagentsSettingsTabInjected } from '../src/client/SubagentsSettingsTab.tsx'

usePinnedBrowserLanguages('zh-CN')
afterEach(cleanup)

const sid = (id: string) => id as SessionId

type InterruptResponse =
  | { readonly result: { readonly ok: true; readonly value: { readonly accepted: true } } }
  | { readonly result: { readonly ok: false; readonly error: { readonly code: string; readonly message: string } } }

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  const actionCalls: { method: string; args: unknown[] }[] = []
  ctx.provide('sessions', {
    openSubagent: (address: SubagentAddress) => { actionCalls.push({ method: 'openSubagent', args: [address] }) },
    refreshSubagents: (parentSessionId: SessionId) => { actionCalls.push({ method: 'refreshSubagents', args: [parentSessionId] }) },
  })
  const interrupt = vi.fn<() => Promise<InterruptResponse>>()
    .mockResolvedValue({ result: { ok: true, value: { accepted: true } } })
  ctx.provide('connection', { api: { subagents: { interrupt } } })
  return { ctx, slots: ctx.get('slots') as SlotRegistry, locale, interrupt, actionCalls }
}

function declare(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: { 'settings.plugins.tab': { kind: 'list', scope: 'root' } },
  } as never, () => null)
}

describe('ui-settings-subagents browser plugin', () => {
  it('declares only the services used by the Settings contribution', () => {
    expect(inject).toEqual(['slots', 'locale', 'sessions', 'connection'])
  })

  it('registers a localized tab whose injected face routes through sessions and connection', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()

    const entry = b.slots.entries('settings.plugins.tab')[0]!
    expect(entry.component).toBe(SubagentsSettingsTab)
    expect(entry.options).toMatchObject({ id: 'subagents', order: 30 })
    expect(entry.locale).toBe(NS)
    expect(resolveSlotLabel(entry.options.label)).toBe('子智能体')

    const address: SubagentAddress = {
      parentSessionId: sid('parent'),
      childSessionId: sid('child'),
      mode: 'continuable',
    }
    const injected = (entry.inject as unknown as () => SubagentsSettingsTabInjected)()
    injected.open(address)
    injected.refresh(sid('parent'))
    expect(b.actionCalls).toEqual([
      { method: 'openSubagent', args: [address] },
      { method: 'refreshSubagents', args: [sid('parent')] },
    ])
    await expect(injected.stop(address)).resolves.toBeUndefined()
    expect(b.interrupt).toHaveBeenCalledWith(address)

    b.interrupt.mockResolvedValueOnce({
      result: { ok: false, error: { code: 'REMOTE_ERROR', message: 'unavailable' } },
    })
    await expect(injected.stop(address)).rejects.toThrow('subagents.interrupt failed: REMOTE_ERROR: unavailable')
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
