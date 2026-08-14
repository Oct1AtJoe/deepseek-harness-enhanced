/**
 * Default model selection for an Agent without a session-specific selection.
 *
 * @module @deepseek-ai/dsh-agent-default-model
 */

import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { ModelSelection } from '@deepseek-ai/dsh-agent'
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Default model selection for Agents created without an explicit model. */
    agentDefaultModel: AgentDefaultModelConfig
  }
}

/** Settings namespace carrying the default model selection for future Agents. */
export const AGENT_DEFAULT_MODEL_SETTINGS_NAMESPACE = settingsNamespace('agent-default-model')

/** Stored and composed default model selection. */
export interface AgentDefaultModelSettings {
  /** Registered provider route. */
  provider: string
  /** Provider-owned model id. */
  model: string
  /** Adapter-owned reasoning effort, or provider/default behavior when absent. */
  reasoningEffort?: string
  /** Last accepted effort per provider/model route, applied when a selection names none. */
  efforts: Record<string, string>
}

/** One route's effort-memory key (provider/model pair). */
function routeOf(provider: string, model: string): string {
  return `${provider}/${model}`
}

/** Schema of the default Agent model settings section. */
export const AGENT_DEFAULT_MODEL_SETTINGS_SCHEMA: z<AgentDefaultModelSettings> = z.object({
  provider: z.string().required(),
  model: z.string().required(),
  reasoningEffort: z.string(),
  efforts: z.dict(z.string()),
})

/** Composition entry for the default model selection. */
export interface Config {
  /** Registered provider route. */
  provider: string
  /** Provider-owned model id. */
  model: string
}

/** Project stored settings onto the Agent-facing selection type. */
function selection(settings: AgentDefaultModelSettings): ModelSelection {
  const effort = settings.reasoningEffort
    ?? settings.efforts[routeOf(settings.provider, settings.model)]
  return {
    provider: settings.provider,
    model: settings.model,
    ...effort === undefined ? {} : { reasoningEffort: ReasoningEffortId(effort) },
  }
}

/**
 * Owns the default model selection independently of any Host or transport.
 * The composition entry remains usable without a settings provider; when one
 * is mounted, its user layer is read live.
 */
export class AgentDefaultModelConfig extends Service {
  static Config: z<Config> = z.object({
    provider: z.string().required(),
    model: z.string().required(),
  })

  private source: () => AgentDefaultModelSettings

  constructor(ctx: Context, config: Config) {
    super(ctx, 'agentDefaultModel')
    const entry: AgentDefaultModelSettings = { provider: config.provider, model: config.model, efforts: {} }
    this.source = () => entry
    installSettingsSection(ctx, AGENT_DEFAULT_MODEL_SETTINGS_NAMESPACE, AGENT_DEFAULT_MODEL_SETTINGS_SCHEMA, entry, {
      setSource: (current) => { this.source = current },
      // Every consumer reads through currentSelection(), so no registration-level fact
      // needs rebuilding when the settings document changes.
      onChange: () => {},
    })
  }

  /**
   * Read the current default model selection.
   * @returns a detached provider, model, and optional reasoning selection.
   */
  currentSelection(): ModelSelection {
    return selection(this.source())
  }

  /**
   * Save the complete default model selection. A deployment without a settings
   * provider keeps its composition entry.
   * @param next - resolved selection accepted by an entry point.
   * @returns fulfillment after the optional settings write settles.
   */
  async saveSelection(next: ModelSelection): Promise<void> {
    await this.ctx.get('settings')?.replace(AGENT_DEFAULT_MODEL_SETTINGS_NAMESPACE, {
      provider: next.provider,
      model: next.model,
      ...next.reasoningEffort === undefined ? {} : { reasoningEffort: String(next.reasoningEffort) },
      efforts: this.source().efforts,
    })
  }

  /**
   * Read the remembered effort for one route, if any.
   * @param provider - provider route.
   * @param model - provider-owned model id.
   * @returns the remembered effort, or undefined.
   */
  modelEffort(provider: string, model: string): string | undefined {
    return this.source().efforts[routeOf(provider, model)]
  }

  /**
   * Record or clear the remembered effort for one route. A deployment without
   * a settings provider keeps its composition entry.
   * @param provider - provider route.
   * @param model - provider-owned model id.
   * @param effort - the effort to remember, or undefined to clear it.
   * @returns fulfillment after the optional settings write settles.
   */
  async saveModelEffort(provider: string, model: string, effort: string | undefined): Promise<void> {
    const current = this.source()
    const route = routeOf(provider, model)
    const efforts: Record<string, string> = {}
    for (const [key, value] of Object.entries(current.efforts)) {
      if (key !== route) efforts[key] = value
    }
    if (effort !== undefined) efforts[route] = effort
    await this.ctx.get('settings')?.replace(AGENT_DEFAULT_MODEL_SETTINGS_NAMESPACE, {
      provider: current.provider,
      model: current.model,
      ...current.reasoningEffort === undefined ? {} : { reasoningEffort: current.reasoningEffort },
      efforts,
    })
  }
}

export default AgentDefaultModelConfig
