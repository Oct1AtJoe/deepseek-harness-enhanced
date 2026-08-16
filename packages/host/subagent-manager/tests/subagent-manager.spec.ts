import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import type { SubagentProvider } from '@deepseek-ai/dsh-subagent'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import SubagentManagerGateway from '../src/index.ts'

const contexts: Context[] = []
const homeDirs: string[] = []
let originalHome: string | undefined

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  for (const dir of homeDirs.splice(0)) await rm(dir, { recursive: true, force: true })
  if (originalHome !== undefined) {
    process.env.DSH_HOME = originalHome
    originalHome = undefined
  }
})

/** A minimal provider that registers under a fixed name with fixed capabilities. */
function provider(name: string): SubagentProvider {
  return {
    name,
    inheritsParentContext: true,
    capabilities: { outputSchema: true, depthLimit: false, toolFilter: false, persona: false },
    async start(): Promise<never> {
      throw new Error(`provider ${name} not exercised`)
    },
  }
}

/** One fake loader entry with the fields the gateway reads. */
function entry(id: string, name: string, config?: Record<string, unknown>, disabled = false, group?: unknown) {
  return {
    id,
    options: {
      id,
      name,
      ...config !== undefined ? { config } : {},
      ...group !== undefined ? { group } : {},
    },
    disabled,
  }
}

/** Point DSH_HOME at a temp dir and return the user patch path. */
async function tempHome(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-subagent-manager-'))
  homeDirs.push(dir)
  originalHome = process.env.DSH_HOME
  process.env.DSH_HOME = dir
  return join(dir, 'cordis.patch.yml')
}

interface BackendRow {
  id: string
  name: string
  config?: Record<string, unknown>
  disabled?: boolean
  group?: unknown
}

async function harness(rows: BackendRow[] = []): Promise<{
  ctx: Context
  gateway: SubagentManagerGateway
  patchPath: string
  register: (name: string) => void
}> {
  const patchPath = await tempHome()
  const ctx = new Context()
  contexts.push(ctx)
  const live = new Set<string>()
  const register = (name: string): void => { live.add(name) }
  ctx.provide('loader', {
    entries: () => rows.map(row => entry(row.id, row.name, row.config, row.disabled ?? false, row.group)),
  })
  ctx.provide('subagents', {
    getProvider: (name: string) => (live.has(name) ? provider(name) : undefined),
  })
  await ctx.plugin(SubagentManagerGateway)
  const gateway = ctx.get('subagentManager') as SubagentManagerGateway
  return { ctx, gateway, patchPath, register }
}

describe('SubagentManagerGateway', () => {
  it('publishes list, install, remove, and updateConfig direct methods', async () => {
    const { gateway } = await harness()
    expect(gateway.typertRemote).toMatchObject({
      serviceKey: 'subagentManager',
      namespace: 'subagentManager',
    })
    expect(remoteMethods(gateway)).toEqual([
      { method: 'list', invocation: { kind: 'direct' } },
      { method: 'install', exportName: 'installBackend', invocation: { kind: 'direct' } },
      { method: 'removeBackend', invocation: { kind: 'direct' } },
      { method: 'updateConfig', invocation: { kind: 'direct' } },
    ])
  })

  it('lists built-in backends with bundle provenance and live capabilities', async () => {
    const { gateway, register } = await harness([
      { id: 'bundle-spawn', name: '@deepseek-ai/dsh-subagent-spawn-in-process', config: { providerName: 'spawn' } },
      { id: 'bundle-fork', name: '@deepseek-ai/dsh-subagent-fork-in-process', config: { providerName: 'fork' } },
    ])
    register('spawn')
    register('fork')
    const snapshot = await gateway.list({})
    // Catalog order: spawn, fork, then the uninstalled optional backends.
    expect(snapshot.backends.map(backend => backend.providerName)).toEqual([
      'spawn', 'fork', 'acp', 'claude-code', 'codex', 'dsh-sdk',
    ])
    expect(snapshot.backends[0]).toMatchObject({
      entryId: 'bundle-spawn',
      moduleName: '@deepseek-ai/dsh-subagent-spawn-in-process',
      providerName: 'spawn',
      installed: true,
      enabled: true,
      source: 'bundle',
      capabilities: { outputSchema: true, depthLimit: false, toolFilter: false, persona: false },
    })
    expect(snapshot.backends[0]!.config).toEqual({ providerName: 'spawn' })
    // Optional backends without a loader row are listed as install candidates.
    expect(snapshot.backends[2]).toMatchObject({
      providerName: 'acp',
      installed: false,
      enabled: false,
      entryId: '@deepseek-ai/dsh-subagent-acp',
    })
    expect(snapshot.backends[2]!.config).toBeUndefined()
    expect(snapshot.backends[2]!.capabilities).toBeUndefined()
    expect(snapshot.tools).toEqual([])
  })

  it('lists named subagent tool rows with their tool name, provider, and model', async () => {
    const { gateway } = await harness([
      {
        id: 'tool-subagent-vision',
        name: '@deepseek-ai/dsh-tool-subagent',
        config: {
          provider: 'spawn',
          toolName: 'subagent_vision',
          backgroundMode: 'one-shot',
          agentOptions: { provider: 'xiaomi', model: 'mimo-v2.5' },
        },
      },
    ])
    const snapshot = await gateway.list({})
    // This harness mounts no backend rows, so only the install candidates appear.
    expect(snapshot.backends.map(backend => backend.providerName)).toEqual([
      'acp', 'claude-code', 'codex', 'dsh-sdk',
    ])
    expect(snapshot.tools).toHaveLength(1)
    expect(snapshot.tools[0]).toMatchObject({
      entryId: 'tool-subagent-vision',
      toolName: 'subagent_vision',
      provider: 'spawn',
      model: 'mimo-v2.5',
      backgroundMode: 'one-shot',
      enabled: true,
      source: 'bundle',
    })
    expect(snapshot.tools[0]!.config).toMatchObject({ toolName: 'subagent_vision' })
  })

  it('removes and reconfigures a named tool row like a backend row', async () => {
    const { gateway, patchPath } = await harness([
      {
        id: 'tool-subagent-vision',
        name: '@deepseek-ai/dsh-tool-subagent',
        config: { provider: 'spawn', toolName: 'subagent_vision' },
      },
    ])
    await gateway.removeBackend({ entryId: 'tool-subagent-vision' })
    let text = await readFile(patchPath, 'utf8')
    expect(text).toContain('- id: "tool-subagent-vision"')
    expect(text).toContain('disabled: true')
    await gateway.updateConfig({
      entryId: 'tool-subagent-vision',
      config: { provider: 'spawn', toolName: 'subagent_vision', agentOptions: { model: 'mimo-v2.5' } },
    })
    text = await readFile(patchPath, 'utf8')
    expect(text).toContain('"agentOptions":{"model":"mimo-v2.5"}')
  })

  it('installs an optional backend into the user patch layer and reports it as user-sourced', async () => {
    const { gateway, patchPath } = await harness()
    await gateway.install({
      moduleName: '@deepseek-ai/dsh-subagent-dsh-sdk',
      providerName: 'dsh-sdk',
      config: { model: 'deepseek-v4-flash' },
    })
    const text = await readFile(patchPath, 'utf8')
    expect(text).toContain('- insert:')
    expect(text).toContain('@deepseek-ai/dsh-subagent-dsh-sdk')
    expect(text).toContain('"model":"deepseek-v4-flash"')
  })

  it('refuses unknown or built-in installs', async () => {
    const { gateway } = await harness()
    await expect(gateway.install({ moduleName: 'nope', providerName: 'nope' }))
      .rejects.toThrow('unknown subagent backend "nope"')
    await expect(gateway.install({ moduleName: '@deepseek-ai/dsh-subagent-spawn-in-process', providerName: 'spawn' }))
      .rejects.toThrow('is built-in')
  })

  it('refuses installing a backend whose row already exists, even disabled', async () => {
    const { gateway } = await harness([
      { id: 'disabled-dsh-sdk', name: '@deepseek-ai/dsh-subagent-dsh-sdk', config: { providerName: 'dsh-sdk' }, disabled: true },
    ])
    await expect(gateway.install({ moduleName: '@deepseek-ai/dsh-subagent-dsh-sdk', providerName: 'dsh-sdk' }))
      .rejects.toThrow('is already installed')
  })

  it('removes a backend by disabling its row, and reconfigures it by config override', async () => {
    const { gateway, patchPath } = await harness([
      { id: 'bundle-spawn', name: '@deepseek-ai/dsh-subagent-spawn-in-process', config: { providerName: 'spawn' } },
      { id: 'bundle-fork', name: '@deepseek-ai/dsh-subagent-fork-in-process', config: { providerName: 'fork' } },
    ])
    await gateway.removeBackend({ entryId: 'bundle-fork' })
    let text = await readFile(patchPath, 'utf8')
    expect(text).toContain('- id: "bundle-fork"')
    expect(text).toContain('disabled: true')
    await gateway.updateConfig({ entryId: 'bundle-spawn', config: { providerName: 'spawn', timeoutMs: 9000 } })
    text = await readFile(patchPath, 'utf8')
    expect(text).toContain('"timeoutMs":9000')
    await expect(gateway.removeBackend({ entryId: 'cordis:nope' })).rejects.toThrow('no loader entry "cordis:nope"')
    // An uninstalled catalog candidate has no loader row and cannot be removed.
    await expect(gateway.removeBackend({ entryId: '@deepseek-ai/dsh-subagent-acp' }))
      .rejects.toThrow('no loader entry "@deepseek-ai/dsh-subagent-acp"')
    await expect(gateway.updateConfig({ entryId: 'cordis:nope', config: {} }))
      .rejects.toThrow('no loader entry "cordis:nope"')
  })

  it('refuses remove and updateConfig for entries that are not subagent rows', async () => {
    const { gateway } = await harness([
      { id: 'cordis:unrelated', name: 'some-plugin' },
      { id: 'tool-subagent-vision', name: '@deepseek-ai/dsh-tool-subagent', config: { providerName: 'spawn' } },
    ])
    await expect(gateway.removeBackend({ entryId: 'cordis:unrelated' }))
      .rejects.toThrow('is not a subagent backend or tool')
    await expect(gateway.updateConfig({ entryId: 'cordis:unrelated', config: {} }))
      .rejects.toThrow('is not a subagent backend or tool')
    await expect(gateway.updateConfig({ entryId: 'tool-subagent-vision' }))
      .rejects.toThrow('requires a config')
  })

  it('reports user provenance for patch rows and insert rows, tolerating malformed patch files', async () => {
    const { gateway, patchPath } = await harness([
      { id: 'bundle-spawn', name: '@deepseek-ai/dsh-subagent-spawn-in-process', config: { providerName: 'spawn' } },
      { id: 'tool-subagent-vision', name: '@deepseek-ai/dsh-tool-subagent', config: { providerName: 'spawn', toolName: 'subagent_vision' } },
    ])
    // A direct override row marks the entry user-sourced.
    await writeFile(patchPath, '- id: "bundle-spawn"\n- id: "tool-subagent-vision"\n', 'utf8')
    let snapshot = await gateway.list({})
    expect(snapshot.backends[0]!.source).toBe('user')
    expect(snapshot.tools[0]!.source).toBe('user')
    // Insert rows match by nested id; null, scalar, and unrelated rows do not.
    await writeFile(patchPath, [
      '- insert:',
      '    - null',
      '    - 42',
      '    - id: "other-inserted"',
      '    - id: "bundle-spawn"',
      '- null',
      '- 42',
      '- id: "other"',
      '',
    ].join('\n'), 'utf8')
    snapshot = await gateway.list({})
    expect(snapshot.backends[0]!.source).toBe('user')
    // A document that is not a row list resolves to bundle provenance.
    await writeFile(patchPath, 'not: a list\n', 'utf8')
    expect((await gateway.list({})).backends[0]!.source).toBe('bundle')
  })

  it('appends cleanly to an empty patch file', async () => {
    const { gateway, patchPath } = await harness()
    await writeFile(patchPath, '', 'utf8')
    await gateway.install({ moduleName: '@deepseek-ai/dsh-subagent-dsh-sdk', providerName: 'dsh-sdk' })
    const text = await readFile(patchPath, 'utf8')
    expect(text).toBe('\n# subagent-manager\n- insert:\n    - id: "@deepseek-ai/dsh-subagent-dsh-sdk"\n      name: "@deepseek-ai/dsh-subagent-dsh-sdk"\n      config: {"providerName":"dsh-sdk"}\n')
  })

  it('installs without config, defaulting to the provider name', async () => {
    const { gateway, patchPath } = await harness()
    await gateway.install({ moduleName: '@deepseek-ai/dsh-subagent-acp', providerName: 'acp' })
    const text = await readFile(patchPath, 'utf8')
    expect(text).toContain('"providerName":"acp"')
    expect(text).not.toContain('"model"')
  })

  it('skips grouped and non-catalog rows, keeping catalog order for duplicate modules', async () => {
    const { gateway } = await harness([
      { id: 'z-spawn', name: '@deepseek-ai/dsh-subagent-spawn-in-process' },
      { id: 'a-spawn', name: '@deepseek-ai/dsh-subagent-spawn-in-process' },
      { id: 'grouped-spawn', name: '@deepseek-ai/dsh-subagent-spawn-in-process', group: 'test' },
      { id: 'unrelated', name: 'some-plugin' },
    ])
    const ids = (await gateway.list({})).backends.map(backend => backend.entryId)
    expect(ids).not.toContain('grouped-spawn')
    expect(ids).not.toContain('unrelated')
    // Both spawn rows survive; the catalog tie is broken by entry id.
    expect(ids.slice(0, 2)).toEqual(['a-spawn', 'z-spawn'])
  })

  it('tolerates tool rows with missing or malformed config fields', async () => {
    const { gateway } = await harness([
      { id: 'tool-minimal', name: '@deepseek-ai/dsh-tool-subagent' },
      { id: 'tool-odd-model', name: '@deepseek-ai/dsh-tool-subagent', config: { provider: 'spawn', agentOptions: { model: 123 } } },
    ])
    const snapshot = await gateway.list({})
    const minimal = snapshot.tools.find(tool => tool.entryId === 'tool-minimal')!
    expect(minimal.toolName).toBe('subagent')
    expect(minimal.provider).toBe('')
    expect(minimal.config).toBeUndefined()
    expect(minimal.backgroundMode).toBeUndefined()
    const odd = snapshot.tools.find(tool => tool.entryId === 'tool-odd-model')!
    expect(odd.model).toBeUndefined()
  })
})
