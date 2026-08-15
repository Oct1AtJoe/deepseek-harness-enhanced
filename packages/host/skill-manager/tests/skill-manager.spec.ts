import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createScope, scopeOf } from '@deepseek-ai/dsh-scope'
import SkillRegistry, {
  type SkillCandidate,
  type SkillDefinition,
  type SkillLookupOptions,
  type SkillProvider,
} from '@deepseek-ai/dsh-skill'
import { SettingsProvider, settingsNamespace, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import SkillManagerGateway from '../src/index.ts'

const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

const sid = (id: string): SessionId => id as SessionId

/** In-memory settings provider: the Service Definition base class owns all tested behavior. */
class MemorySettings extends SettingsProvider {
  doc: Record<string, unknown>

  constructor(ctx: ConstructorParameters<typeof SettingsProvider>[0], options?: { doc?: Record<string, unknown> }) {
    super(ctx)
    this.doc = structuredClone(options?.doc ?? {})
  }

  override get documentPath(): string | undefined {
    return undefined
  }

  override get writable(): boolean {
    return true
  }

  override prepareDocument(): Promise<string | undefined> {
    return Promise.resolve(undefined)
  }

  protected load(): Promise<Record<string, unknown>> {
    return Promise.resolve(structuredClone(this.doc))
  }

  protected persist(ns: SettingsNamespace, section: Record<string, unknown>): Promise<void> {
    this.doc[ns] = structuredClone(section)
    return Promise.resolve()
  }
}

class MemorySkillProvider implements SkillProvider {
  readonly name = 'memory'

  constructor(private readonly candidates: SkillCandidate[]) {}

  async list(_options: SkillLookupOptions): Promise<SkillCandidate[]> {
    return this.candidates
  }

  async get(candidate: SkillCandidate): Promise<SkillDefinition | undefined> {
    const locator = candidate.locator as { content: string }
    return { ...candidate, content: locator.content }
  }
}

function memorySkill(name: string, description: string, providerName = 'memory'): SkillCandidate {
  return {
    name,
    description,
    invocation: { modelInvocable: true, userInvocable: true },
    provider: providerName,
    source: 'memory',
    rank: 100,
    locator: { content: `${name} body.` },
  }
}

/** Fake sessions/agents/agentPresets faces over one attached session record. */
function provideSessionFaces(
  ctx: Context,
  options: {
    cwd?: string
    liveAgent?: unknown
    standingKey?: unknown
    presetRejects?: boolean
  },
): void {
  ctx.provide('sessions', {
    get: (sessionId: SessionId) => (sessionId === sid('viewing')
      ? { header: options.cwd === undefined ? {} : { cwd: options.cwd } }
      : undefined),
  })
  ctx.provide('agents', { get: () => options.liveAgent })
  ctx.provide('agentPresets', {
    standingKeyFor: () => (options.presetRejects === true
      ? Promise.reject(new Error('unknown preset'))
      : Promise.resolve(options.standingKey)),
  })
}

async function harness(options?: {
  doc?: Record<string, unknown>
  cwd?: string
  liveAgent?: unknown
  standingKey?: unknown
  presetRejects?: boolean
}): Promise<{ ctx: Context; gateway: SkillManagerGateway; doc: Record<string, unknown> }> {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(SkillRegistry)
  await ctx.plugin(MemorySettings, options?.doc === undefined ? {} : { doc: options.doc })
  const settings = ctx.get('settings') as MemorySettings
  provideSessionFaces(ctx, {
    cwd: options?.cwd ?? 'E:\\proj',
    ...options?.liveAgent !== undefined ? { liveAgent: options.liveAgent } : {},
    ...options?.standingKey !== undefined ? { standingKey: options.standingKey } : {},
    ...options?.presetRejects === true ? { presetRejects: true } : {},
  })
  ctx.skills.registerProvider(() => new MemorySkillProvider([
    memorySkill('demo-skill', 'Demo skill'),
    memorySkill('user-only', 'User-only skill'),
  ]))
  await ctx.plugin(SkillManagerGateway)
  const gateway = ctx.get('skillManager') as SkillManagerGateway
  return { ctx, gateway, doc: settings.doc }
}

describe('SkillManagerGateway', () => {
  it('publishes list, get, and setInvocation direct methods under the skillManager namespace', async () => {
    const { gateway } = await harness()
    expect(gateway.typertRemote).toMatchObject({
      serviceKey: 'skillManager',
      namespace: 'skillManager',
    })
    expect(remoteMethods(gateway)).toEqual([
      { method: 'list', invocation: { kind: 'direct' } },
      { method: 'get', invocation: { kind: 'direct' } },
      { method: 'setInvocation', invocation: { kind: 'direct' } },
    ])
  })

  it('lists the catalog the viewing session resolves: cwd plus live-agent scope', async () => {
    const { gateway } = await harness()
    const snapshot = await gateway.list({ sessionId: sid('viewing') })
    expect(snapshot.skills.map(skill => skill.name)).toEqual(['demo-skill', 'user-only'])
    expect(snapshot.skills[0]).toMatchObject({
      name: 'demo-skill',
      description: 'Demo skill',
      source: 'memory',
      provider: 'memory',
      invocation: { modelInvocable: true, userInvocable: true },
    })
    const definition = await gateway.get({ sessionId: sid('viewing'), name: 'demo-skill' })
    expect(definition.content).toBe('demo-skill body.')
    await expect(gateway.get({ sessionId: sid('viewing'), name: 'missing' }))
      .rejects.toThrow('skill "missing" is not installed')
    await expect(gateway.get({ sessionId: sid('viewing'), name: 'Not-A-Skill' }))
      .rejects.toThrow('invalid skill name "Not-A-Skill"')
  })

  it('reads through the preset standing scope when no live agent is resident', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(SkillRegistry)
    await ctx.plugin(MemorySettings, {})
    const presetScope = createScope(ctx, { preset: 'web' })
    provideSessionFaces(ctx, { cwd: 'E:\\proj', standingKey: scopeOf(presetScope.ctx) })
    ctx.skills.registerProvider(() => new MemorySkillProvider([memorySkill('preset-skill', 'Preset skill')]))
    // A global-layer provider with a distinct name contributes what the preset layer does not own.
    const globalProvider = new MemorySkillProvider([memorySkill('global-skill', 'Global skill', 'global-memory')])
    Object.defineProperty(globalProvider, 'name', { value: 'global-memory' })
    ctx.skills.registerProvider(() => globalProvider)
    await ctx.plugin(SkillManagerGateway)
    const gateway = ctx.get('skillManager') as SkillManagerGateway
    const snapshot = await gateway.list({ sessionId: sid('viewing') })
    expect(snapshot.skills.map(skill => skill.name)).toEqual(['global-skill', 'preset-skill'])
    await presetScope.dispose()
  })

  it('rejects a missing or cwd-less session, and degrades a broken preset to the global layer', async () => {
    const { gateway } = await harness()
    await expect(gateway.list({ sessionId: sid('absent') })).rejects.toThrow('session "absent" is not attached')
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(SkillRegistry)
    await ctx.plugin(MemorySettings, {})
    provideSessionFaces(ctx, {})
    await ctx.plugin(SkillManagerGateway)
    const cwdless = ctx.get('skillManager') as SkillManagerGateway
    await expect(cwdless.list({ sessionId: sid('viewing') }))
      .rejects.toThrow('session "viewing" has no project cwd')
    const degraded = await harness({ presetRejects: true })
    const snapshot = await degraded.gateway.list({ sessionId: sid('viewing') })
    expect(snapshot.skills.map(skill => skill.name)).toEqual(['demo-skill', 'user-only'])
  })

  it('applies an invocation override live and persists it to the settings document', async () => {
    const { gateway, doc } = await harness()
    await gateway.setInvocation({
      name: 'demo-skill',
      invocation: { modelInvocable: false, userInvocable: true },
    })
    expect((await gateway.list({ sessionId: sid('viewing') })).skills
      .find(skill => skill.name === 'demo-skill')?.invocation)
      .toEqual({ modelInvocable: false, userInvocable: true })
    expect((await gateway.get({ sessionId: sid('viewing'), name: 'demo-skill' })).invocation)
      .toEqual({ modelInvocable: false, userInvocable: true })
    expect(doc[settingsNamespace('skill-overrides')]).toEqual({
      'demo-skill': { modelInvocable: false, userInvocable: true },
    })
    await expect(gateway.setInvocation({
      name: 'bad name',
      invocation: { modelInvocable: true, userInvocable: true },
    })).rejects.toThrow('invalid skill name "bad name"')
  })

  it('restores persisted overrides on a fresh gateway over the same settings document', async () => {
    const first = await harness()
    await first.gateway.setInvocation({
      name: 'user-only',
      invocation: { modelInvocable: false, userInvocable: false },
    })
    const second = await harness({ doc: first.doc })
    expect((await second.gateway.list({ sessionId: sid('viewing') })).skills
      .find(skill => skill.name === 'user-only')?.invocation)
      .toEqual({ modelInvocable: false, userInvocable: false })
  })
})
