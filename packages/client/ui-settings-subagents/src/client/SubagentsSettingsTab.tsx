/** Subagents management tab: cross-session roster with open and stop actions over the sessions service. */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type {
  SessionId,
  SessionListState,
  SubagentAddress,
  SubagentCatalogSnapshot,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './SubagentsSettingsTab.module.css'

/** Registration-side sessions face used by the tab. */
export interface SubagentsSettingsTabInjected {
  /** Open one child's conversation transcript. */
  open: (address: SubagentAddress) => void
  /** Re-request one parent's direct-child catalog. */
  refresh: (parentSessionId: SessionId) => void
  /** Interrupt one running continuable child; rejects on refusal. */
  stop: (address: Extract<SubagentAddress, { mode: 'continuable' }>) => Promise<void>
}

/** Full component props assembled by the Settings slot renderer. */
export type SubagentsSettingsTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<'settings.subagents'>
  & InjectFace<SubagentsSettingsTabInjected>

/** One flattened roster row; catalog diagnostics stay visible but disabled. */
type RosterRow =
  | {
    kind: 'child'
    parentId: SessionId
    id: SessionId
    mode: 'continuable' | 'one-shot'
    running: boolean
    title: string
  }
  | {
    kind: 'unhealthy'
    parentId: SessionId
    id: SessionId
  }

/** Flatten every known catalog into one sorted roster. */
function roster(
  catalogs: SessionListState['subagentsByParent'],
  summaries: SessionListState['byId'],
): RosterRow[] {
  const rows: RosterRow[] = []
  for (const [parentId, catalog] of Object.entries(catalogs)) {
    for (const entry of catalog.entries) {
      if (entry.kind === 'diagnostic') {
        rows.push({ kind: 'unhealthy', parentId: parentId as SessionId, id: entry.id })
        continue
      }
      rows.push({
        kind: 'child',
        parentId: parentId as SessionId,
        id: entry.id,
        mode: entry.mode,
        running: entry.activity === 'running',
        title: entryLabel(entry, summaries[entry.id]?.displayTitle),
      })
    }
  }
  return rows.sort((left, right) => {
    const running = Number(right.kind === 'child' && right.running) - Number(left.kind === 'child' && left.running)
    if (running !== 0) return running
    return (left.kind === 'child' ? left.title : left.id)
      .localeCompare(right.kind === 'child' ? right.title : right.id)
  })
}

/** Resolve the display title for one healthy catalog child. */
function entryLabel(
  entry: Extract<SubagentCatalogSnapshot['entries'][number], { kind: 'child' }>,
  summaryTitle: string | undefined,
): string {
  if (entry.mode === 'continuable') return entry.label
  return entry.label ?? summaryTitle ?? entry.id
}

/** Render one roster row with open/stop actions and per-row failure feedback. */
function RosterRowView({
  row, open, t, stoppingId, stopFailedId, onStop,
}: {
  row: RosterRow
  open: SubagentsSettingsTabInjected['open']
  t: SubagentsSettingsTabProps['t']
  stoppingId: SessionId | null
  stopFailedId: SessionId | null
  onStop: (address: Extract<SubagentAddress, { mode: 'continuable' }>) => void
}): ReactNode {
  const stopping = stoppingId === row.id
  if (row.kind === 'unhealthy') {
    return (
      <li className={css.row} data-unhealthy="true">
        <span className={css.statusDot} data-state="unhealthy" role="img" aria-label={t('unhealthy')} />
        <span className={css.rowTitle}>{row.id}</span>
        <span className={css.rowTag}>{t('unhealthy')}</span>
        <span className={css.rowActions} />
      </li>
    )
  }
  const address: SubagentAddress = {
    parentSessionId: row.parentId,
    childSessionId: row.id,
    mode: row.mode,
  }
  const stoppable = row.running && row.mode === 'continuable'
  return (
    <li className={css.row} data-running={row.running ? 'true' : undefined}>
      <span
        className={css.statusDot}
        data-state={row.running ? 'running' : 'idle'}
        role="img"
        aria-label={row.running ? t('running') : t('idle')}
      />
      <span className={css.rowTitle} title={row.id}>{row.title}</span>
      <span className={css.rowTag} data-mode={row.mode}>
        {t(row.mode === 'continuable' ? 'modeContinuable' : 'modeOneShot')}
      </span>
      <span className={css.rowParent} title={row.parentId}>{row.parentId}</span>
      <span className={css.rowActions}>
        <button type="button" onClick={() => { open(address) }}>{t('actionOpen')}</button>
        {stoppable ? (
          <button
            type="button"
            data-danger="true"
            disabled={stopping}
            onClick={() => {
              onStop({ parentSessionId: row.parentId, childSessionId: row.id, mode: 'continuable' })
            }}
          >
            {stopping ? t('stopping') : t('actionStop')}
          </button>
        ) : null}
      </span>
      {stopFailedId === row.id ? <p className={css.stopFailed} role="alert">{t('stopFailed')}</p> : null}
    </li>
  )
}

/** Render the cross-session subagent roster with open and stop actions. */
export function SubagentsSettingsTab({ open, refresh, stop, t, useSessions }: SubagentsSettingsTabProps): ReactNode {
  const catalogs = useSessions(state => state.subagentsByParent)
  const summaries = useSessions(state => state.byId)
  const rows = useMemo(() => roster(catalogs, summaries), [catalogs, summaries])
  const [stoppingId, setStoppingId] = useState<SessionId | null>(null)
  const [stopFailedId, setStopFailedId] = useState<SessionId | null>(null)
  /** Parents whose catalog this tab already pulled; each new one is fetched once. */
  const pulledParents = useRef<ReadonlySet<SessionId>>(new Set())

  useEffect(() => {
    const parents = new Set<SessionId>()
    for (const summary of Object.values(summaries)) {
      if (summary.origin === 'subagent' && summary.parentId !== undefined) parents.add(summary.parentId)
    }
    const fresh = [...parents].filter(parentId => !pulledParents.current.has(parentId))
    if (fresh.length === 0) return
    for (const parentId of fresh) {
      pulledParents.current = new Set([...pulledParents.current, parentId])
      refresh(parentId)
    }
  }, [refresh, summaries])

  const refreshAll = (): void => {
    for (const parentId of Object.keys(catalogs) as SessionId[]) refresh(parentId)
  }

  const onStop = (address: Extract<SubagentAddress, { mode: 'continuable' }>): void => {
    setStopFailedId(null)
    setStoppingId(address.childSessionId)
    void stop(address).then(
      () => { setStoppingId(null) },
      () => { setStoppingId(null); setStopFailedId(address.childSessionId) },
    )
  }

  return (
    <div className={css.section}>
      <div className={css.heading}>
        <p className={css.intro}>{t('intro')}</p>
        <button type="button" className={css.refresh} onClick={refreshAll}>{t('refresh')}</button>
      </div>
      {rows.length === 0 ? (
        <div className={css.empty}>
          <p>{t('empty')}</p>
          <p>{t('emptyDetail')}</p>
        </div>
      ) : (
        <ul className={css.rows}>
          {rows.map(row => (
            <RosterRowView
              key={row.id}
              row={row}
              open={open}
              t={t}
              stoppingId={stoppingId}
              stopFailedId={stopFailedId}
              onStop={onStop}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
