/** Management Remote over the skill registry: browse, inspect, and persist invocation overrides. */

import type { Context } from '@deepseek-ai/cordis'
import type { SkillInvocationPolicy, SkillSummary, SkillDefinition } from '@deepseek-ai/dsh-skill'
import { isSkillName } from '@deepseek-ai/dsh-skill'
import type { SettingsScope } from '@deepseek-ai/dsh-settings'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import type { ScopeKey } from '@deepseek-ai/dsh-scope'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { resolveSessionPreset } from '@deepseek-ai/dsh-agent-presets'
// Type-only: pull the sessions/agents/agentPresets Context merges for ctx access.
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent-presets'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import z from '@deepseek-ai/schemastery'
import type {
  SetSkillInvocationRequest,
  SkillDefinitionView,
  SkillManagerEntry,
  SkillManagerGetRequest,
  SkillManagerListRequest,
  SkillManagerSnapshot,
} from './types.ts'

export type * from './types.ts'

/** Settings namespace carrying persistent invocation overrides keyed by skill name. */
export const SKILL_OVERRIDES_NS = settingsNamespace('skill-overrides')

/** One override record: the exact invocation policy to force for one skill. */
const OVERRIDES_SCHEMA = z.dict(z.object({
  modelInvocable: z.boolean(),
  userInvocable: z.boolean(),
})).default({})

type SkillOverridesSection = Record<string, SkillInvocationPolicy>

/** One resolved catalog view: the session's project cwd plus the scope its composition serves. */
interface SessionSkillView {
  cwd: string
  scope: ScopeKey | undefined
}

/** Remote-only management surface over the layered skill registry. */
export class SkillManagerGateway extends TypertRemoteService {
  static inject = ['skills', 'settings', 'sessions', 'agents', 'agentPresets']

  /** The registered settings scope; undefined until the settings service effect runs. */
  private scope: SettingsScope<SkillOverridesSection> | undefined
  /** Mirror of the persisted overrides, rebuilt on every write. */
  private readonly overrides = new Map<string, SkillInvocationPolicy>()

  constructor(ctx: Context) {
    super(ctx, 'skillManager')
    ctx.effect(() => {
      const scope = ctx.settings.register(SKILL_OVERRIDES_NS, OVERRIDES_SCHEMA)
      this.scope = scope
      for (const [name, policy] of Object.entries(scope.get())) {
        ctx.skills.setInvocationOverride(name, policy)
      }
      return () => {
        this.scope = undefined
        this.overrides.clear()
      }
    }, 'skill-manager: invocation overrides namespace')
  }

  /**
   * Read the catalog the viewing session's composition serves, with effective
   * invocation policies applied. Listing never creates or resumes an Agent:
   * the session header supplies the project cwd, and the view scope is the
   * live agent or the recorded preset's standing key, exactly like the
   * apiproxy's skills domain — so the page shows the same skills the session's
   * model catalog advertises.
   * @param request - the viewing session.
   * @returns all winning skill summaries in registry order.
   * @throws when the session is not attached or has no project cwd.
   */
  @Remote('list')
  async list(request: SkillManagerListRequest): Promise<SkillManagerSnapshot> {
    const view = await this.resolveSessionView(request.sessionId)
    const skills = await this.ctx.skills.list({ cwd: view.cwd, scope: view.scope })
    return { skills: skills.map(toEntry) }
  }

  /**
   * Load one complete skill body from the viewing session's catalog.
   * @param request - the viewing session plus the kebab-case skill name.
   * @returns the full definition.
   * @throws when the session is unavailable, the name is invalid, or no winning skill exists.
   */
  @Remote('get')
  async get(request: SkillManagerGetRequest): Promise<SkillDefinitionView> {
    if (!isSkillName(request.name)) throw new Error(`invalid skill name "${request.name}"`)
    const view = await this.resolveSessionView(request.sessionId)
    const definition = await this.ctx.skills.get(request.name, { cwd: view.cwd, scope: view.scope })
    if (definition === undefined) throw new Error(`skill "${request.name}" is not installed`)
    return toView(definition)
  }

  /**
   * Force one skill's effective invocation policy and persist the override.
   * The registry applies it to every later list and load, in every scope; the
   * settings document restores it across restarts.
   * @param request - skill name plus the complete next policy.
   * @returns acceptance once the registry and the settings document committed.
   */
  @Remote('setInvocation')
  async setInvocation(request: SetSkillInvocationRequest): Promise<{ accepted: true }> {
    if (!isSkillName(request.name)) throw new Error(`invalid skill name "${request.name}"`)
    const { modelInvocable, userInvocable } = request.invocation
    if (typeof modelInvocable !== 'boolean' || typeof userInvocable !== 'boolean') {
      throw new Error(`invocation policy for skill "${request.name}" must use booleans`)
    }
    this.ctx.skills.setInvocationOverride(request.name, request.invocation)
    const scope = this.scope
    if (scope !== undefined) {
      this.overrides.set(request.name, request.invocation)
      await scope.replace(Object.fromEntries(this.overrides))
    }
    return { accepted: true }
  }

  /** Resolve the project cwd and viewing scope for one session, without side effects. */
  private async resolveSessionView(sessionId: SessionId): Promise<SessionSkillView> {
    const session = this.ctx.sessions.get(sessionId)
    if (session === undefined) throw new Error(`session "${sessionId}" is not attached`)
    const cwd = session.header.cwd
    if (cwd === undefined) {
      throw new Error(`session "${sessionId}" has no project cwd`)
    }
    const live = this.ctx.get('agents')?.get(sessionId)
    if (live !== undefined) return { cwd, scope: live }
    const presets = this.ctx.get('agentPresets')
    if (presets !== undefined) {
      try {
        return { cwd, scope: await presets.standingKeyFor(resolveSessionPreset(session)) }
      } catch {
        // Swallows only the unknown/unusable-preset rejection from the roster:
        // a broken preset must degrade this read to the global layer.
      }
    }
    return { cwd, scope: undefined }
  }
}

/** Project one winning summary onto the management wire shape. */
function toEntry(skill: SkillSummary): SkillManagerEntry {
  return {
    name: skill.name,
    description: skill.description,
    ...skill.whenToUse !== undefined ? { whenToUse: skill.whenToUse } : {},
    source: skill.source,
    provider: skill.provider,
    invocation: skill.invocation,
  }
}

/** Project one loaded definition onto the management wire shape. */
function toView(skill: SkillDefinition): SkillDefinitionView {
  return {
    name: skill.name,
    description: skill.description,
    ...skill.whenToUse !== undefined ? { whenToUse: skill.whenToUse } : {},
    source: skill.source,
    provider: skill.provider,
    invocation: skill.invocation,
    ...skill.path !== undefined ? { path: skill.path } : {},
    content: skill.content,
  }
}

export default SkillManagerGateway
