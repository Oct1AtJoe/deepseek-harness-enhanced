import type { SkillInvocationPolicy } from '@deepseek-ai/dsh-skill'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** Request payload for one catalog read, addressed by the viewing session. */
export interface SkillManagerListRequest {
  /** Session whose project cwd and preset scope select the catalog. */
  readonly sessionId: SessionId
}

/** Request payload for one skill-body read, addressed by the viewing session. */
export interface SkillManagerGetRequest {
  /** Session whose project cwd and preset scope select the catalog. */
  readonly sessionId: SessionId
  /** Kebab-case skill name to load. */
  readonly name: string
}

/** One skill row in the management catalog. */
export interface SkillManagerEntry {
  /** Kebab-case identifier used to address the skill. */
  readonly name: string
  /** Short routing description. */
  readonly description: string
  /** Optional extra routing guidance. */
  readonly whenToUse?: string
  /** Discovery source that produced this winning skill. */
  readonly source: string
  /** Provider that owns this skill body. */
  readonly provider: string
  /** Effective invocation policy, including any user override. */
  readonly invocation: SkillInvocationPolicy
}

/** Point-in-time catalog returned by the skill manager Remote. */
export interface SkillManagerSnapshot {
  readonly skills: readonly SkillManagerEntry[]
}

/** Complete parsed skill definition, including the instruction body. */
export interface SkillDefinitionView {
  readonly name: string
  readonly description: string
  readonly whenToUse?: string
  readonly source: string
  readonly provider: string
  readonly invocation: SkillInvocationPolicy
  readonly path?: string
  /** Markdown instruction body after any provider-specific metadata removal. */
  readonly content: string
}

/** Request payload for one invocation-policy override write. */
export interface SetSkillInvocationRequest {
  /** Kebab-case skill name to override. */
  readonly name: string
  /** Effective invocation policy; replaces the provider-declared policy. */
  readonly invocation: SkillInvocationPolicy
}
