/**
 * Subagent composer action: the tool-row button next to the send button
 * (official `conversation.input.right` list seat). Renders the robot avatar
 * with a live running-subagent count badge; clicking opens the sidebar's
 * subagent tab through the dsh-better-sidebar service (`ctx.betterSidebar`),
 * which owns the subagent topology view. Without that service (plugin not
 * mounted) the button renders but the click is a no-op. Reads only the
 * session-list snapshot (zero RPC), same as the '@' source.
 */
import { useMemo } from 'react'
import clsx from 'clsx'
import { indexSubagentDescendants } from '@deepseek-ai/dsh-client-runtime/client'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { InputZone } from '@deepseek-ai/dsh-client-ui-conversation/src/client/contract/slots.ts'
import { NS } from './locales.ts'
import { NO_DESCENDANTS } from './SubagentCatalogAction.tsx'
import css from './SubagentComposerAction.module.css'

/** 16px robot head: the subagent button avatar. */
function RobotIcon({ className }: { className?: string }) {
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

/** Injected business face of the composer subagent action. */
export interface SubagentComposerInjected {
  /** Open the sidebar's subagent tab (dsh-better-sidebar `openTab`). */
  openSubagentTab: () => void
}

/** Full props for the composer subagent action entry. */
export type SubagentComposerActionProps =
  PropsRuntime<'conversation.input.right'> & InputZone & InjectFace<SubagentComposerInjected> & PropsLocale<typeof NS>

/**
 * Render the subagent affordance in the composer tool row.
 * @param props - session standard kit, the official InputZone owner share,
 * and the injected sidebar-tab opener.
 * @returns the button.
 */
export function SubagentComposerAction({
  sessionId, useSessions, openSubagentTab, t,
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
        onClick={() => { openSubagentTab() }}
      >
        <span className={css.avatar}><RobotIcon /></span>
        {running > 0 && <span className={css.badge}>{running}</span>}
      </button>
    </Tooltip>
  )
}
