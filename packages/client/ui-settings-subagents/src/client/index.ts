/** Subagents management surface, browser half — one Settings tab over the subagent manager Remote. */

import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { SubagentsSettingsTab, type SubagentsSettingsTabInjected } from './SubagentsSettingsTab.tsx'
import { en, zh, type SubagentsLocaleKey } from './locales.ts'

export type { SubagentsSettingsTabInjected, SubagentsSettingsTabProps } from './SubagentsSettingsTab.tsx'
export type { SubagentsLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Subagents management tab copy. */
    'settings.subagents': SubagentsLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.subagents'

/** Services required by the Settings registration and the subagent manager Remote. */
export const inject = ['slots', 'locale', 'remote', 'remote.subagentManager']

/** Contribute the Subagents management tab to the Plugins settings section. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-subagents: dictionaries')

  const t = ctx.locale.bind(NS)
  /** One settled Remote call: a value or a wire error. */
  type RemoteResult<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } }
  /** Run one Remote call and reject with its wire error text. */
  const call = async <T>(method: string, operation: () => Promise<RemoteResult<T>>): Promise<T> => {
    const result = await operation()
    if (!result.ok) {
      throw new Error(`${method} failed: ${result.error.code}: ${result.error.message}`)
    }
    return result.value
  }
  const injected = (): SubagentsSettingsTabInjected => ({
    list: async () => call('subagentManager.list', () => ctx.remote.subagentManager.list({})),
    install: async (request) => { await call('subagentManager.installBackend', () => ctx.remote.subagentManager.installBackend(request)) },
    remove: async (request) => { await call('subagentManager.removeBackend', () => ctx.remote.subagentManager.removeBackend(request)) },
    updateConfig: async (request) => { await call('subagentManager.updateConfig', () => ctx.remote.subagentManager.updateConfig(request)) },
  })

  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'subagents',
    order: 30,
    label: () => t('tab'),
    locale: NS,
    inject: injected,
  }, SubagentsSettingsTab))
}
