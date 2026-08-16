/** Subagents management tab: the installed backend directory with install, remove, and reconfigure. */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type {
  InstallSubagentBackendRequest,
  JsonValue,
  PatchSubagentBackendRequest,
  SubagentBackendCapabilities,
  SubagentBackendEntry,
  SubagentBackendSnapshot,
  SubagentToolEntry,
} from '@deepseek-ai/dsh-api-remotes/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SubagentsLocaleKey } from './locales.ts'
import css from './SubagentsSettingsTab.module.css'

/** Registration-side subagent manager face used by the tab. */
export interface SubagentsSettingsTabInjected {
  /** Read the backend catalog (installed rows plus installable candidates). */
  list: () => Promise<SubagentBackendSnapshot>
  /** Install one optional backend with the given config; rejects on failure. */
  install: (request: InstallSubagentBackendRequest) => Promise<void>
  /** Remove (disable) one installed backend row; rejects on failure. */
  remove: (request: { entryId: string }) => Promise<void>
  /** Replace one backend row's whole config; rejects on failure. */
  updateConfig: (request: PatchSubagentBackendRequest) => Promise<void>
}

/** Full component props assembled by the Settings slot renderer. */
export type SubagentsSettingsTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<'settings.subagents'>
  & InjectFace<SubagentsSettingsTabInjected>

/** Catalog read state of the tab. */
type View =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; backends: readonly SubagentBackendEntry[]; tools: readonly SubagentToolEntry[] }

/** Parse a JSON draft into a config object; reports only validity. */
function parseConfig(draft: string): { ok: boolean; value: Record<string, JsonValue> } {
  const trimmed = draft.trim()
  if (trimmed === '') return { ok: true, value: {} }
  try {
    const value: unknown = JSON.parse(trimmed)
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return { ok: false, value: {} }
    // A JSON-parsed object's values are JSON data by construction.
    return { ok: true, value: value as Record<string, JsonValue> }
  } catch {
    return { ok: false, value: {} }
  }
}

/** Capability labels in catalog order; the tab renders only the true ones. */
const CAPABILITY_LABELS: ReadonlyArray<{ key: keyof SubagentBackendCapabilities; labelKey: SubagentsLocaleKey }> = [
  { key: 'outputSchema', labelKey: 'capOutputSchema' },
  { key: 'depthLimit', labelKey: 'capDepthLimit' },
  { key: 'toolFilter', labelKey: 'capToolFilter' },
  { key: 'persona', labelKey: 'capPersona' },
]

/** Render the enabled capability chips of one backend. */
function CapabilityChips({
  capabilities, t,
}: {
  capabilities: SubagentBackendCapabilities | undefined
  t: SubagentsSettingsTabProps['t']
}): ReactNode {
  if (capabilities === undefined) return null
  const shown = CAPABILITY_LABELS.filter(entry => capabilities[entry.key])
  if (shown.length === 0) return null
  return (
    <ul className={css.chips}>
      {shown.map(entry => <li key={entry.key} className={css.chip}>{t(entry.labelKey)}</li>)}
    </ul>
  )
}

/** Render the JSON config of one backend, or a placeholder when absent. */
function ConfigBlock({
  config, t,
}: {
  config: Record<string, JsonValue> | undefined
  t: SubagentsSettingsTabProps['t']
}): ReactNode {
  return config === undefined
    ? <p className={css.noConfig}>{t('noConfig')}</p>
    : <pre className={css.config}>{JSON.stringify(config, null, 2)}</pre>
}

/** Render one inline JSON editor with save/cancel and a validity error. */
function ConfigEditor({
  draft, error, busy, saveLabel, onDraft, onSave, onCancel, t,
}: {
  draft: string
  error: boolean
  busy: boolean
  saveLabel: string
  onDraft: (draft: string) => void
  onSave: () => void
  onCancel: () => void
  t: SubagentsSettingsTabProps['t']
}): ReactNode {
  return (
    <div className={css.editor}>
      <textarea
        className={css.editorTextarea}
        value={draft}
        spellCheck={false}
        aria-label="JSON"
        onChange={(event) => { onDraft(event.target.value) }}
      />
      {error ? <p className={css.editorError} role="alert">{t('configInvalid')}</p> : null}
      <div className={css.editorActions}>
        <button type="button" className={css.button} data-tone="primary" disabled={busy} onClick={onSave}>
          {busy ? t('saving') : saveLabel}
        </button>
        <button type="button" className={css.button} disabled={busy} onClick={onCancel}>{t('actionCancel')}</button>
      </div>
    </div>
  )
}

/** Render one installed backend card with edit and remove actions. */
function InstalledCard({
  backend, t, editing, removing, busy, onDraft, onEdit, onSave, onCancel, onRemove,
}: {
  backend: SubagentBackendEntry
  t: SubagentsSettingsTabProps['t']
  editing: { entryId: string; draft: string; error: boolean } | null
  removing: string | null
  busy: string | null
  onDraft: (draft: string) => void
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onRemove: () => void
}): ReactNode {
  const isEditing = editing !== null && editing.entryId === backend.entryId
  const isRemoving = removing === backend.entryId
  const isBusy = busy === backend.entryId
  return (
    <li className={css.card}>
      <div className={css.cardHead}>
        <div className={css.cardTitles}>
          <span className={css.cardTitle}>{backend.providerName}</span>
          <span className={css.cardMeta} title={backend.entryId}>{backend.moduleName}</span>
        </div>
        <span className={css.badge} data-tone={backend.source === 'user' ? 'accent' : 'neutral'}>
          {t(backend.source === 'user' ? 'sourceUser' : 'sourceBuiltin')}
        </span>
        <span className={css.badge} data-tone={backend.enabled ? 'success' : 'danger'}>
          {t(backend.enabled ? 'enabled' : 'disabled')}
        </span>
      </div>
      <CapabilityChips capabilities={backend.capabilities} t={t} />
      {isEditing && editing !== null
        ? (
          <ConfigEditor
            draft={editing.draft}
            error={editing.error}
            busy={isBusy}
            saveLabel={t('actionSave')}
            onDraft={onDraft}
            onSave={onSave}
            onCancel={onCancel}
            t={t}
          />
        )
        : (
          <>
            <ConfigBlock config={backend.config} t={t} />
            <div className={css.cardActions}>
              <button type="button" className={css.button} disabled={isBusy} onClick={onEdit}>
                {t('actionEdit')}
              </button>
              <button
                type="button"
                className={css.button}
                data-tone="danger"
                disabled={isBusy}
                onClick={onRemove}
              >
                {isBusy ? t('removing') : isRemoving ? t('actionConfirmRemove') : t('actionRemove')}
              </button>
            </div>
          </>
        )}
    </li>
  )
}

/** Render one installable candidate card with an install editor. */
function CandidateCard({
  backend, t, installing, busy, onDraft, onInstall, onCancel,
}: {
  backend: SubagentBackendEntry
  t: SubagentsSettingsTabProps['t']
  installing: { moduleName: string; draft: string; error: boolean } | null
  busy: string | null
  onDraft: (draft: string) => void
  onInstall: () => void
  onCancel: () => void
}): ReactNode {
  const isInstalling = installing !== null && installing.moduleName === backend.moduleName
  const isBusy = busy === backend.entryId
  return (
    <li className={css.card} data-candidate="true">
      <div className={css.cardHead}>
        <div className={css.cardTitles}>
          <span className={css.cardTitle}>{backend.providerName}</span>
          <span className={css.cardMeta}>{backend.moduleName}</span>
        </div>
        <span className={css.badge} data-tone="neutral">{t('notInstalled')}</span>
      </div>
      {isInstalling && installing !== null
        ? (
          <ConfigEditor
            draft={installing.draft}
            error={installing.error}
            busy={isBusy}
            saveLabel={t('actionInstall')}
            onDraft={onDraft}
            onSave={onInstall}
            onCancel={onCancel}
            t={t}
          />
        )
        : (
          <div className={css.cardActions}>
            <button type="button" className={css.button} data-tone="primary" disabled={isBusy} onClick={onInstall}>
              {t('actionInstall')}
            </button>
          </div>
        )}
    </li>
  )
}

/** Render one named subagent tool card with edit and remove actions. */
function ToolCard({
  tool, t, editing, removing, busy, onDraft, onEdit, onSave, onCancel, onRemove,
}: {
  tool: SubagentToolEntry
  t: SubagentsSettingsTabProps['t']
  editing: { entryId: string; draft: string; error: boolean } | null
  removing: string | null
  busy: string | null
  onDraft: (draft: string) => void
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onRemove: () => void
}): ReactNode {
  const isEditing = editing !== null && editing.entryId === tool.entryId
  const isRemoving = removing === tool.entryId
  const isBusy = busy === tool.entryId
  return (
    <li className={css.card}>
      <div className={css.cardHead}>
        <div className={css.cardTitles}>
          <span className={css.cardTitle}>{tool.toolName}</span>
          <span className={css.cardMeta} title={tool.entryId}>{tool.entryId}</span>
        </div>
        <span className={css.badge} data-tone="neutral">{tool.provider}</span>
        {tool.model !== undefined ? <span className={css.badge} data-tone="accent">{tool.model}</span> : null}
        {tool.backgroundMode !== undefined
          ? (
            <span className={css.badge} data-tone="neutral">
              {t(tool.backgroundMode === 'continuable' ? 'toolModeContinuable' : 'toolModeOneShot')}
            </span>
          )
          : null}
        <span className={css.badge} data-tone={tool.source === 'user' ? 'accent' : 'neutral'}>
          {t(tool.source === 'user' ? 'sourceUser' : 'sourceBuiltin')}
        </span>
        <span className={css.badge} data-tone={tool.enabled ? 'success' : 'danger'}>
          {t(tool.enabled ? 'enabled' : 'disabled')}
        </span>
      </div>
      {isEditing && editing !== null
        ? (
          <ConfigEditor
            draft={editing.draft}
            error={editing.error}
            busy={isBusy}
            saveLabel={t('actionSave')}
            onDraft={onDraft}
            onSave={onSave}
            onCancel={onCancel}
            t={t}
          />
        )
        : (
          <>
            <ConfigBlock config={tool.config} t={t} />
            <div className={css.cardActions}>
              <button type="button" className={css.button} disabled={isBusy} onClick={onEdit}>
                {t('actionEdit')}
              </button>
              <button
                type="button"
                className={css.button}
                data-tone="danger"
                disabled={isBusy}
                onClick={onRemove}
              >
                {isBusy ? t('removing') : isRemoving ? t('actionConfirmRemove') : t('actionRemove')}
              </button>
            </div>
          </>
        )}
    </li>
  )
}

/** Render the subagent backend directory with install, remove, and reconfigure. */
export function SubagentsSettingsTab({ list, install, remove, updateConfig, t }: SubagentsSettingsTabProps): ReactNode {
  const [view, setView] = useState<View>({ status: 'loading' })
  const [editing, setEditing] = useState<{ entryId: string; draft: string; error: boolean } | null>(null)
  const [installing, setInstalling] = useState<{ moduleName: string; draft: string; error: boolean } | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const load = useCallback(async (): Promise<void> => {
    setView({ status: 'loading' })
    try {
      const snapshot = await list()
      setView({ status: 'ready', backends: snapshot.backends, tools: snapshot.tools })
    } catch (error) {
      setView({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }, [list])

  useEffect(() => { void load() }, [load])

  const run = useCallback(async (entryId: string, operation: () => Promise<void>): Promise<void> => {
    setFailure(null)
    setBusy(entryId)
    try {
      await operation()
      setEditing(null)
      setInstalling(null)
      setRemoving(null)
      await load()
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(null)
    }
  }, [install, load, remove, updateConfig])

  const backends = view.status === 'ready' ? view.backends : []
  const tools = view.status === 'ready' ? view.tools : []
  const installed = backends.filter(backend => backend.installed)
  const candidates = backends.filter(backend => !backend.installed)

  if (view.status === 'loading') {
    return <div className={css.section}><p className={css.status}>{t('loading')}</p></div>
  }
  if (view.status === 'error') {
    return (
      <div className={css.section}>
        <p className={css.failure} role="alert">{t('failed')}{view.message}</p>
        <button type="button" className={css.button} onClick={() => { void load() }}>{t('retry')}</button>
      </div>
    )
  }

  return (
    <div className={css.section}>
      <div className={css.heading}>
        <p className={css.intro}>{t('intro')}</p>
        <button type="button" className={css.button} onClick={() => { void load() }}>{t('refresh')}</button>
      </div>
      {failure !== null ? <p className={css.failure} role="alert">{t('opFailed')}{failure}</p> : null}
      <section className={css.group}>
        <h3 className={css.groupTitle}>{t('toolsSection')}<span>{tools.length}</span></h3>
        {tools.length === 0
          ? <p className={css.status}>{t('noTools')}</p>
          : (
            <ul className={css.cards}>
              {tools.map(tool => (
                <ToolCard
                  key={tool.entryId}
                  tool={tool}
                  t={t}
                  editing={editing}
                  removing={removing}
                  busy={busy}
                  onDraft={(draft) => {
                    setEditing(previous => previous === null ? previous : { ...previous, draft, error: false })
                  }}
                  onEdit={() => {
                    setFailure(null)
                    setEditing({ entryId: tool.entryId, draft: JSON.stringify(tool.config ?? {}, null, 2), error: false })
                  }}
                  onSave={() => {
                    if (editing === null || editing.entryId !== tool.entryId) return
                    const parsed = parseConfig(editing.draft)
                    if (!parsed.ok) {
                      setEditing({ ...editing, error: true })
                      return
                    }
                    void run(tool.entryId, () => updateConfig({ entryId: tool.entryId, config: parsed.value }))
                  }}
                  onCancel={() => { setEditing(null); setRemoving(null) }}
                  onRemove={() => {
                    if (removing !== tool.entryId) {
                      setFailure(null)
                      setRemoving(tool.entryId)
                      return
                    }
                    void run(tool.entryId, () => remove({ entryId: tool.entryId }))
                  }}
                />
              ))}
            </ul>
          )}
      </section>
      <section className={css.group}>
        <h3 className={css.groupTitle}>{t('installedSection')}<span>{installed.length}</span></h3>
        {installed.length === 0
          ? <p className={css.status}>{t('noConfig')}</p>
          : (
            <ul className={css.cards}>
              {installed.map(backend => (
                <InstalledCard
                  key={backend.entryId}
                  backend={backend}
                  t={t}
                  editing={editing}
                  removing={removing}
                  busy={busy}
                  onDraft={(draft) => {
                    setEditing(previous => previous === null ? previous : { ...previous, draft, error: false })
                  }}
                  onEdit={() => {
                    setFailure(null)
                    setEditing({ entryId: backend.entryId, draft: JSON.stringify(backend.config ?? {}, null, 2), error: false })
                  }}
                  onSave={() => {
                    if (editing === null || editing.entryId !== backend.entryId) return
                    const parsed = parseConfig(editing.draft)
                    if (!parsed.ok) {
                      setEditing({ ...editing, error: true })
                      return
                    }
                    void run(backend.entryId, () => updateConfig({ entryId: backend.entryId, config: parsed.value }))
                  }}
                  onCancel={() => { setEditing(null); setRemoving(null) }}
                  onRemove={() => {
                    if (removing !== backend.entryId) {
                      setFailure(null)
                      setRemoving(backend.entryId)
                      return
                    }
                    void run(backend.entryId, () => remove({ entryId: backend.entryId }))
                  }}
                />
              ))}
            </ul>
          )}
      </section>
      {candidates.length > 0 ? (
        <section className={css.group}>
          <h3 className={css.groupTitle}>{t('candidatesSection')}<span>{candidates.length}</span></h3>
          <p className={css.status}>{t('candidatesHint')}</p>
          <ul className={css.cards}>
            {candidates.map(backend => (
              <CandidateCard
                key={backend.moduleName}
                backend={backend}
                t={t}
                installing={installing}
                busy={busy}
                onDraft={(draft) => {
                  setInstalling(previous => previous === null ? previous : { ...previous, draft, error: false })
                }}
                onInstall={() => {
                  if (installing !== null && installing.moduleName === backend.moduleName) {
                    const parsed = parseConfig(installing.draft)
                    if (!parsed.ok) {
                      setInstalling({ ...installing, error: true })
                      return
                    }
                    void run(backend.entryId, () => install({
                      moduleName: backend.moduleName,
                      providerName: backend.providerName,
                      config: parsed.value,
                    }))
                    return
                  }
                  setFailure(null)
                  setInstalling({
                    moduleName: backend.moduleName,
                    draft: JSON.stringify({ providerName: backend.providerName }, null, 2),
                    error: false,
                  })
                }}
                onCancel={() => { setInstalling(null) }}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
