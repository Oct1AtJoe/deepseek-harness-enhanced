/**
 * The failed-round resend entry's injected face. The target
 * 'conversation.chat.assistant-actions' slot is declared and typed by
 * ui-conversation; this package only contributes the entry, so no SlotMap
 * merge lives here. The `send` verb resolves the session-scoped conversation
 * service at registration time and re-sends the failed round's user text as a
 * queued turn.
 * @module @deepseek-ai/dsh-client-ui-resend-failed-round/client/slots
 */

import type {
  InjectFace, PropsLocale, PropsRuntime,
} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls this package's LocaleNamespaceMap merge (the 'resend' seat).
import type {} from './locales.ts'

/** Injected business face of one assistant-message resend entry. */
export interface ResendInjected {
  /**
   * Re-send one prompt text as a queued turn through the session-scoped
   * conversation service; a missing service makes the action a no-op.
   */
  send: (text: string) => void
}

/** Full props of one assistant-message resend entry. */
export type ResendActionProps =
  PropsRuntime<'conversation.chat.assistant-actions'>
  & InjectFace<ResendInjected>
  & PropsLocale<'resend'>
