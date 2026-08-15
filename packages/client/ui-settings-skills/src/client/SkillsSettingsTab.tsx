/** Skills management tab: searchable catalog with per-skill invocation switches and body disclosure. */

import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import type {
  SkillDefinitionView,
  SkillManagerEntry,
  SkillManagerSnapshot,
  SetSkillInvocationRequest,
} from '@deepseek-ai/dsh-api-remotes/client'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import {
  IconChevronDownOutline14,
  IconSearchOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './SkillsSettingsTab.module.css'

/** Registration-side Remote face used by the tab. */
export interface SkillsSettingsTabInjected {
  /** Read the catalog the viewing session's composition serves. */
  list: (sessionId: SessionId) => Promise<SkillManagerSnapshot>
  /** Load one complete skill body from the viewing session's catalog. */
  get: (sessionId: SessionId, name: string) => Promise<SkillDefinitionView>
  /** Persist one invocation-policy override. */
  setInvocation: (request: SetSkillInvocationRequest) => Promise<{ accepted: true }>
}

/** Full component props assembled by the Settings slot renderer. */
export type SkillsSettingsTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<'settings.skills'>
  & InjectFace<SkillsSettingsTabInjected>

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly snapshot: SkillManagerSnapshot }

type BodyState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly value: SkillDefinitionView }

/** Whether an inventory row matches the local catalog query. */
function matches(entry: SkillManagerEntry, normalizedQuery: string): boolean {
  if (normalizedQuery.length === 0) return true
  return [entry.name, entry.description, entry.source, entry.provider]
    .some(value => value.toLocaleLowerCase().includes(normalizedQuery))
}

/** Render one skill card with invocation switches and a lazily loaded body. */
function SkillRow({
  sessionId, entry, get, setInvocation, onChanged, t,
}: {
  sessionId: SessionId
  entry: SkillManagerEntry
  get: SkillsSettingsTabInjected['get']
  setInvocation: SkillsSettingsTabInjected['setInvocation']
  onChanged: () => void
  t: SkillsSettingsTabProps['t']
}): ReactNode {
  const detailId = useId()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<'modelInvocable' | 'userInvocable' | null>(null)
  const [writeFailed, setWriteFailed] = useState(false)
  const [body, setBody] = useState<BodyState>({ status: 'idle' })
  /** Monotonic body-load request counter; 0 means never requested. */
  const [load, setLoad] = useState(0)

  useEffect(() => {
    if (!open || load === 0) return
    let current = true
    setBody({ status: 'loading' })
    void get(sessionId, entry.name).then(
      (value) => { if (current) setBody({ status: 'ready', value }) },
      () => { if (current) setBody({ status: 'error' }) },
    )
    return () => { current = false }
  }, [open, load, get, sessionId, entry.name])

  const flip = (field: 'modelInvocable' | 'userInvocable', next: boolean): void => {
    setWriteFailed(false)
    setBusy(field)
    void setInvocation({
      name: entry.name,
      invocation: { ...entry.invocation, [field]: next },
    }).then(
      onChanged,
      () => { setWriteFailed(true) },
    ).finally(() => { setBusy(null) })
  }

  const switchRow = (
    label: string,
    field: 'modelInvocable' | 'userInvocable',
    checked: boolean,
  ): ReactNode => (
    <span className={css.switchRow}>
      <span className={css.switchLabel}>{label}</span>
      <button
        type="button"
        role="switch"
        className={css.switch}
        data-on={checked ? 'true' : undefined}
        data-busy={busy === field ? 'true' : undefined}
        aria-checked={checked}
        aria-label={`${label} ${entry.name}`}
        disabled={busy !== null}
        onClick={() => { flip(field, !checked) }}
      >
        <span className={css.switchKnob} />
      </button>
    </span>
  )

  return (
    <li className={css.card} data-open={open ? 'true' : undefined}>
      <div className={css.cardHeader}>
        <button
          type="button"
          className={css.cardContent}
          aria-expanded={open}
          aria-controls={detailId}
          onClick={() => {
            setOpen(current => !current)
            setLoad(value => value + 1)
          }}
        >
          <strong className={css.cardTitle}>{entry.name}</strong>
          <span className={css.cardDesc}>{entry.description}</span>
          <IconChevronDownOutline14 className={css.chevron} size={12} aria-hidden="true" />
        </button>
        <span className={css.switches}>
          {switchRow(t('modelInvocable'), 'modelInvocable', entry.invocation.modelInvocable)}
          {switchRow(t('userInvocable'), 'userInvocable', entry.invocation.userInvocable)}
        </span>
      </div>
      {writeFailed ? <p className={css.writeFailure} role="alert">{t('failed')}</p> : null}
      {open ? (
        <div className={css.cardDetails} id={detailId}>
          <dl className={css.details}>
            <div>
              <dt>{t('detailSource')}</dt>
              <dd>{entry.source}</dd>
            </div>
            <div>
              <dt>{t('detailProvider')}</dt>
              <dd>{entry.provider}</dd>
            </div>
          </dl>
          {body.status === 'loading' ? <p className={css.contentStatus}>{t('contentLoading')}</p> : null}
          {body.status === 'error' ? (
            <p className={css.contentStatus} role="alert">
              {t('contentFailed')}
              <button type="button" className={css.retry} onClick={() => { setLoad(value => value + 1) }}>
                {t('retry')}
              </button>
            </p>
          ) : null}
          {body.status === 'ready' ? (
            <div className={css.content}>
              <h4>{t('detailContent')}</h4>
              {body.value.path !== undefined
                ? <p className={css.contentPath}><code>{body.value.path}</code></p>
                : null}
              <pre><code>{body.value.content}</code></pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

/** Render the current skill catalog with search, invocation switches, and body disclosure. */
export function SkillsSettingsTab({ list, get, setInvocation, t, useSessions }: SkillsSettingsTabProps): ReactNode {
  const sessionId = useSessions(state => state.current)
  const [request, setRequest] = useState(0)
  const [query, setQuery] = useState('')
  const [state, setState] = useState<ViewState>({ status: 'loading' })

  useEffect(() => {
    if (sessionId === undefined) return
    let current = true
    void Promise.resolve().then(() => list(sessionId)).then(
      (snapshot) => { if (current) setState({ status: 'ready', snapshot }) },
      () => { if (current) setState({ status: 'error' }) },
    )
    return () => { current = false }
  }, [list, sessionId, request])

  const refresh = useCallback(() => { setRequest(value => value + 1) }, [])
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredEntries = useMemo(
    () => state.status === 'ready'
      ? state.snapshot.skills.filter(entry => matches(entry, normalizedQuery))
      : [],
    [normalizedQuery, state],
  )

  const retry = (): void => {
    setState({ status: 'loading' })
    setRequest(value => value + 1)
  }

  if (sessionId === undefined) {
    return <p className={css.status}>{t('noSession')}</p>
  }

  return (
    <div className={css.section} aria-busy={state.status === 'loading'}>
      {state.status === 'loading' ? <p className={css.status}>{t('loading')}</p> : null}
      {state.status === 'error' ? (
        <div className={css.failure}>
          <p role="alert">{t('error')}</p>
          <button type="button" onClick={retry}>{t('retry')}</button>
        </div>
      ) : null}
      {state.status === 'ready' ? (
        <div className={css.catalog}>
          <label className={css.search}>
            <IconSearchOutline16 aria-hidden="true" />
            <span className={css.visuallyHidden}>{t('search')}</span>
            <input
              type="search"
              value={query}
              placeholder={t('search')}
              aria-label={t('search')}
              onChange={(event) => { setQuery(event.currentTarget.value) }}
            />
          </label>
          <div className={css.catalogHeading}>
            <h3>{t('catalog')}</h3>
            <span data-skill-count={filteredEntries.length}>{filteredEntries.length}</span>
          </div>
          {state.snapshot.skills.length === 0 ? <p className={css.status}>{t('empty')}</p> : null}
          {state.snapshot.skills.length > 0 && filteredEntries.length === 0
            ? <p className={css.status}>{t('emptySearch')}</p>
            : null}
          {filteredEntries.length > 0 ? (
            <ul className={css.cards}>
              {filteredEntries.map(entry => (
                <SkillRow
                  key={entry.name}
                  sessionId={sessionId}
                  entry={entry}
                  get={get}
                  setInvocation={setInvocation}
                  onChanged={refresh}
                  t={t}
                />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
