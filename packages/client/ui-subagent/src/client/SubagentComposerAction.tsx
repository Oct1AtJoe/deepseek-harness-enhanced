/**
 * Subagent composer action: the tool-row button next to the send button
 * (official `conversation.input.right` list seat). Renders the robot avatar
 * with a live running-subagent count badge; clicking switches the session's
 * view ring to the subagent work tab through the conversation service. Reads
 * only the session-list snapshot (zero RPC), same as the '@' source.
 */
import { useMemo } from 'react'
import clsx from 'clsx'
import { indexSubagentDescendants } from '@deepseek-ai/dsh-client-runtime/client'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { InputZone } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { NS } from './locales.ts'
import { RobotIcon } from './SubagentWorkView.tsx'
import { NO_DESCENDANTS } from './SubagentCatalogAction.tsx'
import css from './SubagentComposerAction.module.css'

/** The work view's view-ring id — the switch target of this button. */
export const SUBAGENT_VIEW_ID = 'subagent'

/** Injected business face of the composer subagent action. */
export interface SubagentComposerInjected {
  /** Switch the session's active view-ring tab (the subagent work view). */
  setView: (view: string) => void
}

/** Full props for the composer subagent action entry. */
export type SubagentComposerActionProps =
  PropsRuntime<'conversation.input.right'> & InputZone & InjectFace<SubagentComposerInjected> & PropsLocale<typeof NS>

/**
 * Render the subagent affordance in the composer tool row.
 * @param props - session standard kit, the official InputZone owner share,
 * and the injected view-ring switch.
 * @returns the button.
 */
export function SubagentComposerAction({
  sessionId, useSessions, setView, t,
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
        onClick={() => { setView(SUBAGENT_VIEW_ID) }}
      >
        <span className={css.avatar}><RobotIcon /></span>
        {running > 0 && <span className={css.badge}>{running}</span>}
      </button>
    </Tooltip>
  )
}
