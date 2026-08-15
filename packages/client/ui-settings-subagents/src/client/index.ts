/** Subagents management surface, browser half — one Settings tab over the sessions service. */

import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
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

/** Services required by the Settings registration and session navigation. */
export const inject = ['slots', 'locale', 'sessions', 'connection']

/** Contribute the Subagents management tab to the Plugins settings section. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-subagents: dictionaries')

  const t = ctx.locale.bind(NS)
  const { api } = ctx.get('connection') as ConnectionHandle
  const stop: SubagentsSettingsTabInjected['stop'] = async (address) => {
    const response = await api.subagents.interrupt(address)
    const result = response.result
    if (!result.ok) {
      throw new Error(`subagents.interrupt failed: ${result.error.code}: ${result.error.message}`)
    }
  }
  const injected = (): SubagentsSettingsTabInjected => ({
    open(address) {
      ctx.sessions.openSubagent(address)
    },
    refresh(parentSessionId) {
      ctx.sessions.refreshSubagents(parentSessionId)
    },
    stop,
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
