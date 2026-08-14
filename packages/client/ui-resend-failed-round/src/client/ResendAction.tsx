/**
 * Failed-round resend action: a re-run entry in the turn-tail zone of a turn
 * that ended terminally (turn-error or turn-max-tokens). Rendered next to the
 * produced-files row; clicking re-sends the failed round's user text as a new
 * queued turn through the session-scoped conversation service. Unlike the
 * assistant-action strip, the turn tail exists for failure rounds too (the
 * closing assistant message may never have landed), which is why this entry
 * hangs there.
 * @module @deepseek-ai/dsh-client-ui-resend-failed-round/client/ResendAction
 */

import { useMemo } from 'react'
import {
  IconRefreshOutline16, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { ChatSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { ResendActionProps } from './slots.ts'
import css from './ResendAction.module.css'

/**
 * Resend target of a failed round: the last user message whose following turn
 * ended terminally, plus that turn's number. Null when the tail is healthy,
 * the session is running, or no user message exists. Re-sends the message's
 * plain text (images are not replayed).
 */
export function failedRoundTarget(
  order: readonly string[],
  nodeStore: ChatSnapshot['nodes'],
  running: boolean,
): { turn: number; text: string } | null {
  if (running) return null
  let text = ''
  let hasUser = false
  let failedTurn: number | null = null
  for (const key of order) {
    const node = nodeStore.get(key)
    if (node === undefined) continue
    if (node.kind === 'user') {
      const content = (node.data as { content: readonly { type?: string; text?: string }[] }).content
      let joined = ''
      for (const block of content) {
        if (block.type === 'text' && typeof block.text === 'string') joined += block.text
      }
      text = joined
      hasUser = true
    } else if (node.kind === 'turn-error' || node.kind === 'turn-max-tokens') {
      const turn = (node.data as { turn?: number }).turn
      if (typeof turn === 'number') failedTurn = turn
    }
  }
  return hasUser && failedTurn !== null ? { turn: failedTurn, text } : null
}

/**
 * One failed round's re-run control in the turn-tail zone.
 * @param props - the tail's owner share (its turn), the injected send verb
 * and chat hook, and the locale seat.
 * @returns the re-run button, or null when this turn is not the failed round.
 */
export function ResendAction({ turn, send, t, useChat }: ResendActionProps) {
  // The failed-round target rides order (stable except on row enter/leave),
  // so content deltas never recompute it.
  const order = useChat(s => s.chat.order)
  const nodeStore = useChat(s => s.chat.nodes)
  const running = useChat(s => s.running)
  const target = useMemo(
    () => failedRoundTarget(order, nodeStore, running),
    [order, nodeStore, running],
  )
  if (target === null || target.turn !== turn.turn) return null
  const label = t('action.resend')
  return (
    <Tooltip label={label} side="top" delayMs={500}>
      <button
        type="button"
        className={css.button}
        aria-label={label}
        onClick={() => { send(target.text) }}
      >
        <IconRefreshOutline16 />
        <span>{label}</span>
      </button>
    </Tooltip>
  )
}
