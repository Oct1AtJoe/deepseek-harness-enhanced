/**
 * Subagent work view: the conversation view-ring tab that shows this
 * session's subagent tree live — robot avatar rows with running state,
 * active-turn duration ticking per second, token usage, and click-to-open
 * (the opened child conversation IS the work process). Reads the same
 * session-list catalog data as the header SubagentCatalogAction; zero RPC
 * beyond the mount-time catalog refresh.
 */
import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react'
import {
  indexSubagentDescendants, type SessionId, type SessionListState, type SessionSummary,
  type SubagentAddress, type SubagentCatalogSnapshot,
} from '@deepseek-ai/dsh-client-runtime/client'
import {
  IconChevronRightOutline14, IconRefreshOutline14, StateDot,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { NS } from './locales.ts'
import {
  activityDuration, formatDuration, formatExactDuration, formatTokens,
  NO_DESCENDANTS, tokenTotal,
} from './SubagentCatalogAction.tsx'
import css from './SubagentWorkView.module.css'

type CatalogEntry = SubagentCatalogSnapshot['entries'][number]
type Catalogs = SessionListState['subagentsByParent']

/** Business actions supplied by the slot registration. */
export interface SubagentWorkViewInjected {
  openChild: (address: SubagentAddress) => void
  refresh: (parentSessionId: SessionId) => void
}

/** Full props for the subagent work view entry. */
export type SubagentWorkViewProps =
  PropsRuntime<'conversation.view'> & SubagentWorkViewInjected & PropsLocale<typeof NS>

/** 16px robot head: the subagent row/button avatar. */
export function RobotIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" className={className} aria-hidden="true">
      <path
        d="M8 1.4c.55 0 1 .45 1 1v1.05c1.7.35 2.95 1.8 3.08 3.55h.42c.83 0 1.5.67 1.5 1.5v3.5c0 .83-.67 1.5-1.5 1.5H3.5c-.83 0-1.5-.67-1.5-1.5V8.5c0-.83.67-1.5 1.5-1.5h.42c.13-1.75 1.38-3.2 3.08-3.55V2.4c0-.55.45-1 1-1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <circle cx="5.7" cy="9.1" r="0.9" fill="currentColor" />
      <circle cx="10.3" cy="9.1" r="0.9" fill="currentColor" />
      <path d="M5.4 11.6h5.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  )
}

interface WorkRowsProps {
  parentSessionId: SessionId
  catalog: SubagentCatalogSnapshot
  catalogs: Catalogs
  summaries: Readonly<Record<SessionId, SessionSummary>>
  expanded: ReadonlySet<SessionId>
  now: number
  openChild: (address: SubagentAddress) => void
  refresh: (parentSessionId: SessionId) => void
  toggleBranch: (childSessionId: SessionId) => void
  t: TranslateNS<typeof NS>
}

/** Render the known direct-child shape while its authoritative catalog hydrates. */
function LoadingRows({
  parentSessionId, summaries, t,
}: {
  parentSessionId: SessionId
  summaries: Readonly<Record<SessionId, SessionSummary>>
  t: TranslateNS<typeof NS>
}) {
  const children = Object.values(summaries).filter(summary => (
    summary.origin === 'subagent' && summary.parentId === parentSessionId
  ))
  if (children.length === 0) return <div className={css.notice}>{t('loading.label')}</div>
  return children.map(summary => (
    <div key={summary.id} className={css.node}>
      <div className={css.rowLine}>
        <span className={css.disclosureSpace} />
        <div className={`${css.row} ${css.disabled} ${css.loadingRow}`} aria-disabled="true">
          <span className={css.avatar}><RobotIcon /></span>
          <span className={css.content}>
            <span className={css.label}>{t('loading.label')}</span>
          </span>
        </div>
      </div>
    </div>
  ))
}

function diagnosticReason(
  entry: Extract<CatalogEntry, { kind: 'diagnostic' }>,
  t: TranslateNS<typeof NS>,
): string {
  switch (entry.reason) {
    case 'corrupt': return t('diagnostic.corrupt')
    case 'unsupported': return t('diagnostic.unsupported')
    case 'unavailable': return t('diagnostic.unavailable')
  }
}

/** Render one catalog level and recurse only through explicitly expanded branches. */
function WorkRows({
  parentSessionId, catalog, catalogs, summaries, expanded, now,
  openChild, refresh, toggleBranch, t,
}: WorkRowsProps) {
  const emptyLoading = catalog.state === 'loading' && catalog.entries.length === 0
  const reserveDisclosure = catalog.entries.some(
    entry => entry.kind === 'child' && entry.hasChildren,
  )
  return (
    <>
      {emptyLoading && (
        <LoadingRows parentSessionId={parentSessionId} summaries={summaries} t={t} />
      )}
      {catalog.state === 'error' && (
        <div className={css.error}>
          <span>{catalog.error?.message ?? t('load.error')}</span>
          <button
            type="button"
            className={css.refresh}
            onClick={() => { refresh(parentSessionId) }}
          >
            <IconRefreshOutline14 />
            {t('retry')}
          </button>
        </div>
      )}
      {catalog.entries.map((entry) => {
        if (entry.kind === 'diagnostic') {
          const reason = diagnosticReason(entry, t)
          return (
            <div key={entry.id} className={css.node}>
              <div className={css.rowLine}>
                {reserveDisclosure && <span className={css.disclosureSpace} />}
                <div
                  className={`${css.row} ${css.disabled}`}
                  aria-disabled="true"
                  title={reason}
                >
                  <span className={css.avatar}><RobotIcon /></span>
                  <span className={css.content}>
                    <span className={css.label}>{entry.id}</span>
                    <span className={css.summary}>{reason}</span>
                  </span>
                </div>
              </div>
            </div>
          )
        }

        const childCatalog = catalogs[entry.id]
        const isExpanded = expanded.has(entry.id)
        const knownLeaf = !entry.hasChildren
        const summary = summaries[entry.id]
        const label = entry.label ?? summary?.displayTitle ?? entry.id
        const mode = entry.mode === 'one-shot' ? t('mode.oneShot') : t('mode.continuable')
        const activity = entry.activity === 'running' ? t('activity.running') : t('activity.inactive')
        const secondary = [summary?.title, mode, activity]
          .filter(value => value !== undefined)
          .join(' · ')
        const totalTokens = tokenTotal(summary?.projectionValues?.tokenUsage)
        const durationMs = activityDuration(summary, entry.activity, now)
        const tokenMetric = totalTokens === undefined
          ? undefined
          : `${formatTokens(totalTokens)} tok`
        const durationMetric = durationMs === undefined
          ? undefined
          : {
            compact: formatDuration(durationMs, t),
            exact: formatExactDuration(durationMs, t),
          }
        const metrics = [tokenMetric, durationMetric?.exact]
          .filter(value => value !== undefined)
          .join(' · ')

        const open = (): void => {
          openChild({ parentSessionId, childSessionId: entry.id, mode: entry.mode })
        }
        const handleKey = (event: KeyboardEvent<HTMLButtonElement>): void => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            event.stopPropagation()
            open()
          }
        }
        const toggle = (event: MouseEvent<HTMLButtonElement>): void => {
          event.preventDefault()
          event.stopPropagation()
          toggleBranch(entry.id)
        }

        return (
          <div key={entry.id} className={css.node}>
            <div className={css.rowLine}>
              {knownLeaf
                ? reserveDisclosure && <span className={css.disclosureSpace} />
                : (
                  <button
                    type="button"
                    className={`${css.disclosure} ${isExpanded ? css.disclosureOpen : ''}`}
                    aria-label={t(isExpanded ? 'branch.collapse' : 'branch.expand', { label })}
                    aria-expanded={isExpanded}
                    onClick={toggle}
                  >
                    <IconChevronRightOutline14 />
                  </button>
                )}
              <button
                type="button"
                className={css.row}
                title={t('work.openHint')}
                onClick={open}
                onKeyDown={handleKey}
              >
                <span className={css.avatar}><RobotIcon /></span>
                <StateDot state={entry.activity === 'running' ? 'ongoing' : 'done'} />
                <span className={css.content}>
                  <span className={css.label}>{label}</span>
                  <span className={css.summary}>{secondary}</span>
                </span>
                {metrics !== '' && (
                  <span className={css.metrics}>
                    {tokenMetric !== undefined && <span className={css.metricToken}>{tokenMetric}</span>}
                    {durationMetric !== undefined && (
                      <span
                        className={css.metricDuration}
                        title={t('duration.exactTitle', { duration: durationMetric.exact })}
                      >
                        {durationMetric.compact}
                      </span>
                    )}
                  </span>
                )}
              </button>
            </div>
            {isExpanded && !knownLeaf && (
              <div className={css.children} aria-busy={childCatalog === undefined || undefined}>
                {childCatalog === undefined
                  ? (
                    <LoadingRows
                      parentSessionId={entry.id}
                      summaries={summaries}
                      t={t}
                    />
                  )
                  : (
                    <WorkRows
                      parentSessionId={entry.id}
                      catalog={childCatalog}
                      catalogs={catalogs}
                      summaries={summaries}
                      expanded={expanded}
                      now={now}
                      openChild={openChild}
                      refresh={refresh}
                      toggleBranch={toggleBranch}
                      t={t}
                    />
                  )}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

/**
 * Render the current session's subagent tree as a conversation view tab.
 * @param props - session standard props plus catalog navigation actions.
 * @returns the work view; an empty state while the session has no subagents.
 */
export function SubagentWorkView({
  sessionId, useSessions, openChild, refresh, t,
}: SubagentWorkViewProps) {
  const catalogs = useSessions(state => state.subagentsByParent)
  const summaries = useSessions(state => state.byId)
  const catalog = catalogs[sessionId]
  const [expanded, setExpanded] = useState<ReadonlySet<SessionId>>(() => new Set())
  const [now, setNow] = useState(() => Date.now())
  const descendants = useMemo(
    () => indexSubagentDescendants(summaries).get(sessionId) ?? NO_DESCENDANTS,
    [sessionId, summaries],
  )

  // Fresh catalog on mount: the tab is an explicit look, so a pull beats a
  // stale snapshot from the last selection.
  useEffect(() => { refresh(sessionId) }, [refresh, sessionId])

  // Durations tick only while anything runs.
  useEffect(() => {
    if (descendants.runningCount === 0) return
    const timer = setInterval(() => { setNow(Date.now()) }, 1_000)
    return () => { clearInterval(timer) }
  }, [descendants.runningCount])

  const toggleBranch = (childSessionId: SessionId): void => {
    setExpanded(current => {
      const next = new Set(current)
      if (next.has(childSessionId)) next.delete(childSessionId)
      else next.add(childSessionId)
      return next
    })
  }

  // The summary-backed loading posture matches the header action: catalog
  // rows can lag session summaries by a frame.
  const summaryBackedLoading = descendants.count > 0
    && (catalog === undefined || (catalog.state === 'ready' && catalog.entries.length === 0))
  const presentedCatalog: SubagentCatalogSnapshot | undefined = summaryBackedLoading
    ? { entries: [], parentAvailable: catalog?.parentAvailable ?? false, state: 'loading', error: null }
    : catalog
  const empty = descendants.count === 0 && presentedCatalog?.state === 'ready'
    && presentedCatalog.entries.length === 0

  return (
    <div className={css.root} role="region" aria-label={t('work.title')}>
      <div className={css.toolbar}>
        <h2 className={css.title}>{t('work.title')}</h2>
        <span className={css.counts}>
          {descendants.runningCount > 0 && (
            <span className={css.running}>
              <StateDot state="ongoing" />
              {t(descendants.runningCount === 1 ? 'work.running.one' : 'work.running.other', {
                count: descendants.runningCount,
              })}
            </span>
          )}
          {descendants.count > 0 && (
            <span className={css.total}>
              {t(descendants.count === 1 ? 'count.total.one' : 'count.total.other', {
                count: descendants.count,
              })}
            </span>
          )}
        </span>
        <button
          type="button"
          className={css.refresh}
          onClick={() => { refresh(sessionId) }}
        >
          <IconRefreshOutline14 />
          {t('work.refresh')}
        </button>
      </div>
      {empty ? (
        <div className={css.empty}>
          <span className={css.emptyIcon}><RobotIcon /></span>
          <span className={css.emptyTitle}>{t('work.empty')}</span>
          <span className={css.emptyHint}>{t('work.emptyHint')}</span>
        </div>
      ) : presentedCatalog === undefined ? (
        <div className={css.notice}>{t('loading.label')}</div>
      ) : (
        <div className={css.list}>
          <WorkRows
            parentSessionId={sessionId}
            catalog={presentedCatalog}
            catalogs={catalogs}
            summaries={summaries}
            expanded={expanded}
            now={now}
            openChild={openChild}
            refresh={refresh}
            toggleBranch={toggleBranch}
            t={t}
          />
        </div>
      )}
    </div>
  )
}
