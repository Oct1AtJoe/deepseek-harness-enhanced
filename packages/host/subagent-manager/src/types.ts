/** Wire types for the subagent backend management Remote. */

import type { JsonValue } from '@deepseek-ai/dsh-session/types'

/** Backend provenance: where the loader row comes from. */
export type SubagentBackendSource = 'bundle' | 'user'

/** One subagent backend row in the management catalog. */
export interface SubagentBackendEntry {
  /** Loader entry id of the backend row; the catalog module name when not installed. */
  readonly entryId: string
  /** Module specifier of the backend plugin. */
  readonly moduleName: string
  /** Provider name registered in `ctx.subagents` when the row is enabled. */
  readonly providerName: string
  /** Whether a loader row currently exists for this backend. */
  readonly installed: boolean
  /** Whether the row is currently disabled by a patch override. */
  readonly enabled: boolean
  /** Which patch layer contributed the row ('bundle' for uninstalled catalog rows). */
  readonly source: SubagentBackendSource
  /** Capabilities of the registered provider, when it is live. */
  readonly capabilities?: SubagentBackendCapabilities
  /** Effective config of the row after patch overrides, when the row has one. */
  readonly config?: Record<string, JsonValue>
}

/** Start-time features one backend provider supports. */
export interface SubagentBackendCapabilities {
  readonly outputSchema: boolean
  readonly depthLimit: boolean
  readonly toolFilter: boolean
  readonly persona: boolean
}

/** Request payload for listing the backend catalog. The catalog is global, so the payload is empty. */
export interface SubagentManagerListRequest {
}

/** One named subagent tool row (`@deepseek-ai/dsh-tool-subagent`). */
export interface SubagentToolEntry {
  /** Loader entry id of the tool row. */
  readonly entryId: string
  /** The tool's registered name (config `toolName`, default `subagent`). */
  readonly toolName: string
  /** The `ctx.subagents` provider the tool delegates to (config `provider`). */
  readonly provider: string
  /** LLM model of the child, when `agentOptions` carries one. */
  readonly model?: string
  /** Background policy of the tool (config `backgroundMode`). */
  readonly backgroundMode?: string
  /** Whether the row is currently disabled by a patch override. */
  readonly enabled: boolean
  /** Which patch layer contributed the row. */
  readonly source: SubagentBackendSource
  /** The tool's whole config, for editing. */
  readonly config?: Record<string, JsonValue>
}

/** Catalog response of the subagent manager Remote. */
export interface SubagentBackendSnapshot {
  readonly backends: readonly SubagentBackendEntry[]
  /** Named subagent tool rows (`@deepseek-ai/dsh-tool-subagent`). */
  readonly tools: readonly SubagentToolEntry[]
}

/** Request payload for installing one backend into the user patch layer. */
export interface InstallSubagentBackendRequest {
  /** Module specifier of the backend plugin to install. */
  readonly moduleName: string
  /** Provider name the backend registers (its `providerName` config). */
  readonly providerName: string
  /** Optional initial config for the new row. */
  readonly config?: Record<string, JsonValue>
}

/** Request payload for removing or reconfiguring one backend row. */
export interface PatchSubagentBackendRequest {
  /** Loader entry id of the backend row to patch. */
  readonly entryId: string
  /** Replacement config (shallow-replaces the row's whole config). */
  readonly config?: Record<string, JsonValue>
}
