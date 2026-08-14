/**
 * Subagent composer seat: the tool-row button right of the access-mode
 * control. Renders the robot avatar with a live running-subagent count badge;
 * clicking switches the session's view ring to the subagent work tab. Reads
 * only the session-list snapshot (zero RPC), same as the '@' source.
 */
import { useMemo } from 'react'
import clsx from 'clsx'
import { indexSubagentDescendants } from '@deepseek-ai/dsh-client-runtime/client'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ComposerSubagentOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { NS } from './locales.ts'
import { RobotIcon } from './SubagentWorkView.tsx'
import { NO_DESCENDANTS } from './SubagentCatalogAction.tsx'
import css from './SubagentComposerAction.module.css'

/** The work view's view-ring id — the switch target of this button. */
export const SUBAGENT_VIEW_ID = 'subagent'

/** Full props for the composer subagent seat entry. */
export type SubagentComposerActionProps =
  PropsRuntime<'conversation.input.subagent'> & ComposerSubagentOwnerProps & PropsLocale<typeof NS>

/**
 * Render the subagent affordance in the composer tool row.
 * @param props - session standard kit, seat owner share (locked + setView).
 * @returns the button, or null while the seat is locked.
 */
export function SubagentComposerAction({
  sessionId, useSessions, locked, setView, t,
}: SubagentComposerActionProps) {
  const byId = useSessions(state => state.byId)
  const descendants = useMemo(
    () => indexSubagentDescendants(byId).get(sessionId) ?? NO_DESCENDANTS,
    [sessionId, byId],
  )
  const running = descendants.runningCount
  const label = running > 0
    ? t(running === 1 ? 'button.running.one' : 'button.running.other', { count: running })
    : t('button.open')

  return (
    <Tooltip label={label} side="top" delayMs={500}>
      <button
        type="button"
        className={clsx(css.button, running > 0 && css.live)}
        aria-label={label}
        disabled={locked}
        onClick={() => { setView(SUBAGENT_VIEW_ID) }}
      >
        <span className={css.avatar}><RobotIcon /></span>
        {running > 0 && <span className={css.badge}>{running}</span>}
      </button>
    </Tooltip>
  )
}
