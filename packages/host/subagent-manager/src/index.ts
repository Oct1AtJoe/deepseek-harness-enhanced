/** Management Remote over subagent backends and named subagent tools: catalog, install, remove, and reconfigure. */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import { parseDocument } from 'yaml'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import type { JsonValue } from '@deepseek-ai/dsh-session/types'
import type { SubagentProvider } from '@deepseek-ai/dsh-subagent'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import type {
  InstallSubagentBackendRequest,
  PatchSubagentBackendRequest,
  SubagentBackendCapabilities,
  SubagentBackendEntry,
  SubagentBackendSnapshot,
  SubagentManagerListRequest,
  SubagentToolEntry,
} from './types.ts'

export type * from './types.ts'

/** Module of the named-subagent-tool plugin (one tool row = one named subagent). */
const TOOL_SUBAGENT_MODULE = '@deepseek-ai/dsh-tool-subagent'

/** Backend catalog: every subagent backend this harness ships. */
interface BackendSpec {
  readonly moduleName: string
  readonly providerName: string
  /** Built-in backends live in the base bundle and cannot be installed or removed. */
  readonly builtin: boolean
}

const BACKEND_CATALOG: readonly BackendSpec[] = [
  { moduleName: '@deepseek-ai/dsh-subagent-spawn-in-process', providerName: 'spawn', builtin: true },
  { moduleName: '@deepseek-ai/dsh-subagent-fork-in-process', providerName: 'fork', builtin: true },
  { moduleName: '@deepseek-ai/dsh-subagent-acp', providerName: 'acp', builtin: false },
  { moduleName: '@deepseek-ai/dsh-subagent-claude-code', providerName: 'claude-code', builtin: false },
  { moduleName: '@deepseek-ai/dsh-subagent-codex', providerName: 'codex', builtin: false },
  { moduleName: '@deepseek-ai/dsh-subagent-dsh-sdk', providerName: 'dsh-sdk', builtin: false },
]

/** The user patch layer filename inside the harness home (see dsh-app-boot profile.ts). */
const USER_PATCH_FILENAME = 'cordis.patch.yml'

/** The absolute path of the harness-wide user patch layer (hot-reloaded by boot). */
function userPatchPath(): string {
  return join(dshHomePath(), USER_PATCH_FILENAME)
}

/** Read the current user patch layer text; create the file with a template header when absent. */
async function readOrInitPatch(): Promise<string> {
  const path = userPatchPath()
  try {
    return await readFile(path, 'utf8')
  } catch {
    const template = `# Your patch layer for this dsh harness, applied after every profile's bundle
# layers: a top-level YAML array of loader patch entries (id-targeted config
# overrides, disables, and insert lists; \`!!js\` expressions allowed). Edited
# live by the subagent backend manager — save takes effect through HMR.
`
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, template, 'utf8')
    return template
  }
}

/** Append one patch block to the user patch layer, preserving comments and layout. */
async function appendPatch(block: string): Promise<void> {
  const path = userPatchPath()
  const text = await readOrInitPatch()
  const separator = text.trim().length === 0 ? '' : '\n'
  await writeFile(path, `${text}${separator}\n# subagent-manager\n${block}\n`, 'utf8')
}

/** Render one override patch entry with JSON-flow config (valid YAML). */
function renderOverride(entry: { id: string; disabled?: boolean; config?: Record<string, JsonValue> }): string {
  const lines = [`- id: ${JSON.stringify(entry.id)}`]
  if (entry.disabled !== undefined) lines.push(`  disabled: ${entry.disabled}`)
  if (entry.config !== undefined) lines.push(`  config: ${JSON.stringify(entry.config)}`)
  return lines.join('\n')
}

/** One current loader row (the Loader yields them lazily). */
type LoaderRow = {
  id: string
  disabled: boolean
  options: { name: string; group?: unknown; config?: Record<string, unknown> }
}

/** The current loader rows (the Loader yields them lazily). */
function loaderEntries(ctx: Context): Array<LoaderRow> {
  return [...ctx.loader.entries()]
}

/** Resolve the catalog spec for a module name. */
function specFor(moduleName: string): BackendSpec | undefined {
  return BACKEND_CATALOG.find(spec => spec.moduleName === moduleName)
}

/** Whether a loader row is a subagent backend or a named subagent tool. */
function isSubagentRow(name: string): boolean {
  return specFor(name) !== undefined || name === TOOL_SUBAGENT_MODULE
}

/** Read one string field from a tool config (schema-validated JSON by contract). */
function toolConfigString(config: Record<string, JsonValue> | undefined, key: string): string | undefined {
  if (config === undefined) return undefined
  const value = config[key]
  return typeof value === 'string' ? value : undefined
}

/** Read the child LLM model from a tool config's `agentOptions`. */
function toolConfigModel(config: Record<string, JsonValue> | undefined): string | undefined {
  const agentOptions = config?.agentOptions
  if (agentOptions === null || typeof agentOptions !== 'object' || Array.isArray(agentOptions)) return undefined
  const model = (agentOptions as Record<string, JsonValue>).model
  return typeof model === 'string' ? model : undefined
}

/**
 * Management surface over the subagent backend catalog. Reads merge the
 * Loader's configured rows with the live provider registry; writes append
 * patches to the harness-wide user patch layer, which the boot watcher
 * hot-reloads, so changes take effect without a restart.
 */
export class SubagentManagerGateway extends TypertRemoteService {
  static inject = ['loader', 'subagents']

  constructor(ctx: Context) {
    super(ctx, 'subagentManager')
  }

  /**
   * List every configured subagent backend row and named subagent tool with
   * provenance and live capabilities.
   * @param request - the catalog request; currently empty.
   * @returns the backend catalog snapshot.
   */
  @Remote('list')
  async list(request: SubagentManagerListRequest): Promise<SubagentBackendSnapshot> {
    void request
    const backends: SubagentBackendEntry[] = []
    const tools: SubagentToolEntry[] = []
    const rows = loaderEntries(this.ctx)
    for (const entry of rows) {
      if (entry.options.group) continue
      if (entry.options.name === TOOL_SUBAGENT_MODULE) {
        const config = entry.options.config as Record<string, JsonValue> | undefined
        const model = toolConfigModel(config)
        const backgroundMode = toolConfigString(config, 'backgroundMode')
        tools.push({
          entryId: entry.id,
          toolName: toolConfigString(config, 'toolName') ?? 'subagent',
          provider: toolConfigString(config, 'provider') ?? '',
          ...model !== undefined ? { model } : {},
          ...backgroundMode !== undefined ? { backgroundMode } : {},
          enabled: !entry.disabled,
          source: await this.isUserRow(entry.id) ? 'user' : 'bundle',
          ...config !== undefined ? { config } : {},
        })
        continue
      }
      const spec = specFor(entry.options.name)
      if (spec === undefined) continue
      const provider = this.ctx.subagents.getProvider(spec.providerName)
      backends.push({
        entryId: entry.id,
        moduleName: spec.moduleName,
        providerName: spec.providerName,
        installed: true,
        enabled: !entry.disabled,
        source: await this.isUserRow(entry.id) ? 'user' : 'bundle',
        ...provider !== undefined ? { capabilities: toCapabilities(provider) } : {},
        ...entry.options.config !== undefined
          // The loader's config values are schema-validated JSON by contract.
          ? { config: entry.options.config as Record<string, JsonValue> }
          : {},
      })
    }
    const present = new Set(rows.map(entry => entry.options.name))
    for (const spec of BACKEND_CATALOG) {
      if (spec.builtin || present.has(spec.moduleName)) continue
      // Uninstalled optional backends stay visible so the UI can offer install.
      backends.push({
        entryId: spec.moduleName,
        moduleName: spec.moduleName,
        providerName: spec.providerName,
        installed: false,
        enabled: false,
        source: 'bundle',
      })
    }
    backends.sort((left, right) => {
      const li = BACKEND_CATALOG.findIndex(spec => spec.moduleName === left.moduleName)
      const ri = BACKEND_CATALOG.findIndex(spec => spec.moduleName === right.moduleName)
      return li - ri || left.entryId.localeCompare(right.entryId)
    })
    tools.sort((left, right) => left.entryId.localeCompare(right.entryId))
    return { backends, tools }
  }

  /**
   * Install one optional backend by appending an insert block to the user
   * patch layer. Built-in backends are refused.
   * @param request - module, provider name, and optional initial config.
   * @returns acceptance once the patch layer holds the new row.
   * @throws when the module is unknown or built-in, or the row already exists.
   */
  @Remote('installBackend')
  async install(request: InstallSubagentBackendRequest): Promise<{ accepted: true }> {
    const spec = specFor(request.moduleName)
    if (spec === undefined) throw new Error(`unknown subagent backend "${request.moduleName}"`)
    if (spec.builtin) throw new Error(`backend "${spec.moduleName}" is built-in and cannot be installed`)
    const existing = loaderEntries(this.ctx).find(entry => entry.options.name === spec.moduleName)
    if (existing !== undefined) {
      // A second insert under the same id would trip the loader's duplicate
      // id check; a disabled row needs manual patch cleanup, not a re-insert.
      throw new Error(`backend "${spec.moduleName}" is already installed (${existing.id})`)
    }
    const config = {
      providerName: spec.providerName,
      ...request.config !== undefined ? request.config : {},
    }
    const insert = `- insert:\n    - id: ${JSON.stringify(spec.moduleName)}\n      name: ${JSON.stringify(spec.moduleName)}\n      config: ${JSON.stringify(config)}`
    await appendPatch(insert)
    return { accepted: true }
  }

  /**
   * Remove (disable) one backend or named-tool row by appending a disable
   * override.
   * @param request - the loader entry id of the backend or tool row.
   * @returns acceptance once the patch layer disables the row.
   * @throws when the entry is not a known subagent row.
   */
  @Remote('removeBackend')
  async removeBackend(request: { entryId: string }): Promise<{ accepted: true }> {
    const entry = loaderEntries(this.ctx).find(candidate => candidate.id === request.entryId)
    if (entry === undefined) throw new Error(`no loader entry "${request.entryId}"`)
    if (!isSubagentRow(entry.options.name)) {
      throw new Error(`entry "${request.entryId}" is not a subagent backend or tool`)
    }
    await appendPatch(renderOverride({ id: request.entryId, disabled: true }))
    return { accepted: true }
  }

  /**
   * Replace one backend or named-tool row's config by appending a config
   * override. The override shallow-replaces the whole config, so callers send
   * the complete next config.
   * @param request - the loader entry id and the complete next config.
   * @returns acceptance once the patch layer holds the override.
   * @throws when the entry is not a known subagent row.
   */
  @Remote('updateConfig')
  async updateConfig(request: PatchSubagentBackendRequest): Promise<{ accepted: true }> {
    const entry = loaderEntries(this.ctx).find(candidate => candidate.id === request.entryId)
    if (entry === undefined) throw new Error(`no loader entry "${request.entryId}"`)
    if (!isSubagentRow(entry.options.name)) {
      throw new Error(`entry "${request.entryId}" is not a subagent backend or tool`)
    }
    if (request.config === undefined) throw new Error('updateConfig requires a config')
    await appendPatch(renderOverride({ id: request.entryId, config: request.config }))
    return { accepted: true }
  }

  /** Whether a loader entry id appears in the user patch layer (insert or override). */
  private async isUserRow(entryId: string): Promise<boolean> {
    const path = userPatchPath()
    try {
      const document = parseDocument(await readFile(path, 'utf8'))
      const rows = document.toJS() as unknown[] | null
      if (!Array.isArray(rows)) return false
      return rows.some((row) => {
        if (row === null || typeof row !== 'object') return false
        const patch = row as Record<string, unknown>
        if (patch.id === entryId) return true
        if (Array.isArray(patch.insert)) {
          return patch.insert.some((inserted) => {
            if (inserted === null || typeof inserted !== 'object') return false
            return (inserted as Record<string, unknown>).id === entryId
          })
        }
        return false
      })
    } catch {
      return false
    }
  }
}

/** Project a live provider's capability flags onto the wire shape. */
function toCapabilities(provider: SubagentProvider): SubagentBackendCapabilities {
  return {
    outputSchema: provider.capabilities.outputSchema,
    depthLimit: provider.capabilities.depthLimit,
    toolFilter: provider.capabilities.toolFilter,
    persona: provider.capabilities.persona,
  }
}

export default SubagentManagerGateway
