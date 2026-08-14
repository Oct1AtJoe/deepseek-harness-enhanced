/**
 * Failed-round resend plugin, browser half: the re-run entry in the
 * conversation.chat.turnTail zone. The entry computes the failed round target
 * from the live chat node store (the last user message whose following turn
 * ended terminally) and re-sends that text through the session-scoped
 * conversation service. The turn tail exists for failure rounds even when no
 * assistant message landed, unlike the assistant-action strip.
 * @module @deepseek-ai/dsh-client-ui-resend-failed-round/client
 */

import type { ClientContext, ConversationSnapshot, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the ui-conversation SlotMap merge (the turnTail entry) and
// the conversation service contract.
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

// Static no-session source for the hooks compartment: module constants so the
// render side's per-source hook cache keeps one identity across renders.
const EMPTY_CHAT = {
  chat: { order: [], nodes: new Map() },
  running: false,
} as unknown as ConversationSnapshot
const ABSENT_CHAT: HostObservable<ConversationSnapshot> = {
  getSnapshot: () => EMPTY_CHAT,
  subscribe: () => () => {},
}

/**
 * Client plugin body: the failed-round re-run entry in the turn-tail zone.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-resend-failed-round: dictionaries')

  ctx.slots.inject('conversation.chat.turnTail', () =>
    ctx.slots.register({
      name: 'conversation.chat.turnTail',
      // Always selected; the entry returns null on healthy turns, so the
      // chain renders nothing extra there.
      select: () => ({}),
      priority: 20,
      locale: NS,
      inject: (sessionId: SessionId): ResendInjected => {
        const face = ctx.sessions.binding(sessionId)?.session
        const conversation = ctx.sessions.scope(sessionId)?.get('conversation') as IConversation | undefined
        return {
          hooks: {
            chat: face ?? ABSENT_CHAT,
          },
          // Send failures surface through the session promptError strip.
          send: (text) => { if (conversation !== undefined) void conversation.send(text) },
        }
      },
    }, ResendAction))
}
