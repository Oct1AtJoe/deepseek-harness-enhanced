// @vitest-environment jsdom
/**
 * ui-theme-custom registration contract: the aurora and nebula themes join
 * the official registry snapshot on mount, select/persist like built-ins,
 * leave the registry on fiber teardown (HMR safety), and the drift keyframes
 * ride a runtime style element that teardown removes. Driven against a real
 * ThemeRuntime so the assertions cover the actual registry projection.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { stubSettingsScope, type StubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import type { ThemeSettings } from '@deepseek-ai/dsh-client-ui-theme/client'
import { ThemeRuntime } from '@deepseek-ai/dsh-client-ui-theme/client'
import { apply as applyLocale, inject as localeInject } from '@deepseek-ai/dsh-client-locale/client'
import { apply, inject } from '../src/client/index.ts'

let theme: ThemeRuntime
let host: StubSettingsScope<ThemeSettings>
/** Mounted fibers, disposed together in afterEach so no spec leaves a live registration. */
const fibers: { dispose: () => Promise<void> }[] = []

/** Mount the plugin over the slot registry, locale, and a stubbed durable scope. */
async function mount(): Promise<{ dispose: () => Promise<void> }> {
  const ctx = new Context()
  host = stubSettingsScope<ThemeSettings>()
  theme = new ThemeRuntime(ctx, host.scope)
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.register({
    name: 'root',
    children: {
      'settings.general.item': { kind: 'list', scope: 'root' },
    },
  } as never, () => null)
  ctx.provide('connection', { api: { settings: {} }, isLoopback: false } as never)
  ctx.provide('remote', { $on: () => () => {} } as never)
  ctx.provide('settingsScope', { bind: () => stubSettingsScope().scope } as never)
  ctx.provide('theme', theme)
  await ctx.plugin({ inject: localeInject, apply: applyLocale }).await()
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  const handle = { dispose: () => fiber.dispose() }
  fibers.push(handle)
  return handle
}

afterEach(async () => {
  while (fibers.length > 0) await fibers.pop()?.dispose()
})

describe('ui-theme-custom theme registration', () => {
  it('registers aurora and nebula onto the registry snapshot', async () => {
    await mount()
    expect(theme.getTheme().themes.map(t => t.id)).toEqual(['light', 'dark', 'aurora', 'nebula'])
    const aurora = theme.getTheme().themes.find(t => t.id === 'aurora')
    expect(aurora?.colorScheme).toBe('dark')
    expect(aurora?.tokens['--dsw-alias-brand-primary']).toMatch(/^rgb\(/)
    expect(aurora?.tokens['--dsw-alias-bg-base']).toMatch(/^rgb\(/)
    const nebula = theme.getTheme().themes.find(t => t.id === 'nebula')
    expect(nebula?.colorScheme).toBe('dark')
    expect(nebula?.tokens['--dsw-alias-glass-blur']).toContain('blur')
    expect(nebula?.tokens['--dsw-specific-bubble']).toMatch(/^rgba\(/)
  })

  it('selects nebula: dark scheme, glass + gradient tokens, persisted preference', async () => {
    await mount()
    theme.setTheme('nebula')
    const active = theme.getTheme().active
    expect(active.colorScheme).toBe('dark')
    expect(active.tokens['--dsw-alias-button-primary-bg']).toContain('linear-gradient')
    expect(active.tokens['--dsw-alias-button-primary-fill']).toMatch(/^rgb\(/)
    expect(active.tokens['--dsw-alias-button-glow']).toContain('inset')
    expect(active.tokens['--dsw-alias-button-press-shift']).toContain('translate')
    expect(host.set).toHaveBeenCalledWith('preference', 'nebula')
  })

  it('selects aurora: dark scheme, violet tokens, persisted preference', async () => {
    await mount()
    theme.setTheme('aurora')
    const active = theme.getTheme().active
    expect(active.colorScheme).toBe('dark')
    expect(active.tokens['--dsw-alias-brand-primary']).toMatch(/^rgb\(/)
    expect(host.set).toHaveBeenCalledWith('preference', 'aurora')
  })

  it('fiber teardown disposes both registrations (HMR safety)', async () => {
    const mounted = await mount()
    await mounted.dispose()
    expect(theme.getTheme().themes.map(t => t.id)).toEqual(['light', 'dark'])
  })

  it('injects the button-drift keyframes and removes them on teardown', async () => {
    const mounted = await mount()
    const tag = document.head.querySelector('style[data-ui-theme-custom-keyframes]')
    expect(tag).not.toBeNull()
    expect(tag?.textContent).toContain('dsh-button-drift')
    await mounted.dispose()
    expect(document.head.querySelector('style[data-ui-theme-custom-keyframes]')).toBeNull()
  })

  it('disposing the active custom theme resets the preference to default', async () => {
    const mounted = await mount()
    theme.setTheme('aurora')
    await mounted.dispose()
    expect(theme.getTheme().preference).toBe('system')
    expect(theme.getTheme().themes.map(t => t.id)).toEqual(['light', 'dark'])
  })
})
