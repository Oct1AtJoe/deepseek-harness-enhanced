/**
 * Failed-round resend plugin, browser half: the re-run entry in the
 * conversation.chat.assistant-actions strip. The entry computes the failed
 * round target from the live chat node store (the last user message whose
 * following turn ended terminally) and re-sends that text through the
 * session-scoped conversation service.
 * @module @deepseek-ai/dsh-client-ui-resend-failed-round/client
 */

import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the ui-conversation SlotMap merge (the assistant-actions
// entry) and the conversation service contract.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { IConversation } from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { ResendAction } from './ResendAction.tsx'
import type { ResendInjected } from './slots.ts'
import { en, zh } from './locales.ts'

/** Dictionary namespace owned by this plugin. */
const NS = 'resend'

/** Required services: the slot registry, the session scope index, and the copy. */
export const inject = ['slots', 'sessions', 'locale']

/**
 * Client plugin body: the per-message re-run entry for failed rounds.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-resend-failed-round: dictionaries')

  ctx.slots.inject('conversation.chat.assistant-actions', () =>
    ctx.slots.register({
      name: 'conversation.chat.assistant-actions',
      id: 'resend-failed-round',
      // After the feedback entry (order 10), before later strips.
      order: 20,
      locale: NS,
      inject: (sessionId: SessionId): ResendInjected => {
        const conversation = ctx.sessions.scope(sessionId)?.get('conversation') as IConversation | undefined
        return {
          // Send failures surface through the session promptError strip.
          send: (text) => { if (conversation !== undefined) void conversation.send(text) },
        }
      },
    }, ResendAction))
}
