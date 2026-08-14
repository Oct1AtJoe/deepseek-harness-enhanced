/**
 * Failed-round resend action: a refresh button in the assistant message's
 * IconActions row, shown only on the reply of the last turn that ended
 * terminally (turn-error or max-tokens). Clicking re-sends the failed round's
 * user text as a new queued turn.
 * @module @deepseek-ai/dsh-client-ui-resend-failed-round/client/ResendAction
 */

import { useMemo } from 'react'
import {
  IconRefreshOutline16, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { ChatSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { MessageId } from '@deepseek-ai/dsh-client-connection/client'
import type { ResendActionProps } from './slots.ts'
import css from './ResendAction.module.css'

/**
 * Resend target of a failed round: the last user message whose following turn
 * ended terminally, plus the messageId of its (failed) assistant reply — the
 * strip entry renders on that reply. Null when the tail is healthy, the
 * session is running, or no user message exists. Re-sends the message's plain
 * text (images are not replayed).
 */
export function failedRoundTarget(
  order: readonly string[],
  nodeStore: ChatSnapshot['nodes'],
  running: boolean,
): { messageId: MessageId; text: string } | null {
  if (running) return null
  let text = ''
  let hasUser = false
  let replyMessageId: MessageId | null = null
  let failed = false
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
      failed = false
    } else if (node.kind === 'assistant') {
      const finalNode = (node.data as { finalNode?: { messageId?: MessageId } }).finalNode
      if (finalNode?.messageId !== undefined) replyMessageId = finalNode.messageId
    } else if (node.kind === 'turn-error' || node.kind === 'turn-max-tokens') {
      failed = true
    }
  }
  return hasUser && failed && replyMessageId !== null ? { messageId: replyMessageId, text } : null
}

/**
 * One assistant message's re-run control.
 * @param props - the owner's message identity, the injected send verb, and
 * the locale seat.
 * @returns the refresh button, or null when this message is not the failed
 * round's reply.
 */
export function ResendAction({ messageId, send, t, useSession }: ResendActionProps) {
  // The failed-round target rides order (stable except on row enter/leave),
  // so content deltas never recompute it.
  const order = useSession(s => s.chat.order)
  const nodeStore = useSession(s => s.chat.nodes)
  const running = useSession(s => s.running)
  const target = useMemo(
    () => failedRoundTarget(order, nodeStore, running),
    [order, nodeStore, running],
  )
  if (target === null || messageId !== target.messageId) return null
  const label = t('action.resend')
  return (
    <Tooltip label={label} side="bottom">
      <button
        type="button"
        className={css.action}
        aria-label={label}
        onClick={() => { send(target.text) }}
      >
        <IconRefreshOutline16 />
      </button>
    </Tooltip>
  )
}
