/**
 * Browser half of dsh-client-ui-msg-nav: registers the conversation composer
 * dock entry that renders the node navigation rail.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the conversation SlotMap declarations ('conversation.composer.dock').
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { makeNavRail } from './NavRail.tsx'

/** Required services for slot registration and session access. */
export const inject = ['slots', 'sessions']

/**
 * Client plugin body: register the rail into the composer dock.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const NavRail = makeNavRail(ctx.sessions)
  ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register(
    {
      name: 'conversation.composer.dock',
      id: 'msg-nav',
      order: 10,
    },
    NavRail,
  ))
}
