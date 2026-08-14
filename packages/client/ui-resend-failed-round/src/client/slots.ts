/**
 * The failed-round resend entry's injected face. The target
 * 'conversation.chat.turnTail' slot is declared and typed by ui-conversation;
 * this package only contributes the entry, so no SlotMap merge lives here.
 * The chat snapshot source rides the `chat` hook (bound to `useChat` by the
 * renderer); `send` resolves the session-scoped conversation service at
 * registration time and re-sends the failed round's user text as a queued
 * turn.
 * @module @deepseek-ai/dsh-client-ui-resend-failed-round/client/slots
 */

import type {
  HostObservable, InjectFace, PropsLocale, PropsRuntime,
} from '@deepseek-ai/dsh-client-ui-slots'
import type { ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the ui-conversation SlotMap merge (the turnTail entry) and
// its owner share.
import type { TurnTailOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls this package's LocaleNamespaceMap merge (the 'resend' seat).
import type {} from './locales.ts'

/** Injected business face of one turn-tail resend entry. */
export interface ResendInjected {
  hooks: {
    /** The owning Session's conversation snapshot (chat order + nodes + running). */
    chat: HostObservable<ConversationSnapshot>
  }
  /**
   * Re-send one prompt text as a queued turn through the session-scoped
   * conversation service; a missing service makes the action a no-op.
   */
  send: (text: string) => void
}

/** Full props of one turn-tail resend entry. */
export type ResendActionProps =
  PropsRuntime<'conversation.chat.turnTail'>
  & TurnTailOwnerProps
  & InjectFace<ResendInjected>
  & PropsLocale<'resend'>
