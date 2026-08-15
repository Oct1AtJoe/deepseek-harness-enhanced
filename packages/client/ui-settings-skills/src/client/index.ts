/** Skills management surface, browser half — one Settings tab over the skill-manager Remote. */

import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { SkillsSettingsTab, type SkillsSettingsTabInjected } from './SkillsSettingsTab.tsx'
import { en, zh, type SkillsLocaleKey } from './locales.ts'

export type { SkillsSettingsTabInjected, SkillsSettingsTabProps } from './SkillsSettingsTab.tsx'
export type { SkillsLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Skills management tab copy. */
    'settings.skills': SkillsLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.skills'

/** Services required by the Settings registration and generated Remote face. */
export const inject = ['slots', 'locale', 'remote', 'remote.skillManager']

/** Contribute the Skills management tab to the Plugins settings section. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-skills: dictionaries')

  const t = ctx.locale.bind(NS)
  const list: SkillsSettingsTabInjected['list'] = async (sessionId) => {
    const result = await ctx.remote.skillManager.list({ sessionId })
    if (!result.ok) {
      throw new Error(`skillManager.list failed: ${result.error.code}: ${result.error.message}`)
    }
    return result.value
  }
  const get: SkillsSettingsTabInjected['get'] = async (sessionId, name) => {
    const result = await ctx.remote.skillManager.get({ sessionId, name })
    if (!result.ok) {
      throw new Error(`skillManager.get failed: ${result.error.code}: ${result.error.message}`)
    }
    return result.value
  }
  const setInvocation: SkillsSettingsTabInjected['setInvocation'] = async (request) => {
    const result = await ctx.remote.skillManager.setInvocation(request)
    if (!result.ok) {
      throw new Error(`skillManager.setInvocation failed: ${result.error.code}: ${result.error.message}`)
    }
    return result.value
  }
  const injected = (): SkillsSettingsTabInjected => ({ list, get, setInvocation })

  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'skills',
    order: 20,
    label: () => t('tab'),
    locale: NS,
    inject: injected,
  }, SkillsSettingsTab))
}
