/**
 * The `notification` projection unit: a pure fold of the session log into a
 * bounded summary of the last completed turn (reason, reply text, tool names).
 * Registered on `ctx.sessionProjections`, the seam drives `apply` over every
 * committed session event and delivers the `view` to the client for every
 * session — no harness allowlist change. The fold is pure and unit-tested;
 * the registration is the only effect.
 */
import { z } from 'zod'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import type { NotificationProjectionState, NotificationProjectionValue } from './contract.ts'
import type { ResolvedConfig } from './types.ts'

export type { NotificationProjectionState }

/**
 * Minimal structural event for the fold: the client aggregate must not import
 * the host-side session package, so the fold accepts any session event and
 * narrows each handled case with a local cast. The seam's real SessionEvent is
 * always assignable to this open shape.
 */
export type NotificationEvent = { type: string; data: Record<string, unknown> }

/** The empty-log view (no completed turn yet). */
export const EMPTY_PROJECTION: NotificationProjectionValue = Object.freeze({
  turn: 0,
  reason: '',
  body: '',
  tools: Object.freeze([]) as readonly string[],
})

/**
 * Bound one reply to the body budget, ellipsizing on overflow. Kept in the
 * fold so the persisted state never grows past the budget.
 * @param text - the accumulated reply text.
 * @param maxChars - the character budget.
 * @returns the bounded text.
 */
export function boundText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars - 1) + '…'
}

/**
 * Apply one committed event to the fold state. Uninteresting events return the
 * same reference (Object.is gates the change feed).
 * @param state - the state covering all prior events.
 * @param event - the next committed event.
 * @param maxChars - the body budget.
 * @returns the next state.
 */
export function applyProjectionEvent(
  state: NotificationProjectionState,
  event: NotificationEvent,
  maxChars: number,
): NotificationProjectionState {
  switch (event.type) {
    case 'turn/start': {
      const { turn } = event.data as { turn: number }
      return { ...state, openTurn: { turn, text: '', tools: [] } }
    }
    case 'assistant/message': {
      const { turn, message } = event.data as { turn: number; message: { content: readonly { type: string; text?: string }[] } }
      const open = state.openTurn
      if (open === null || open.turn !== turn) return state
      let text = open.text
      for (const block of message.content) {
        if (block.type === 'text') text += block.text
      }
      if (text.length > maxChars) text = boundText(text, maxChars)
      if (text === open.text) return state
      return { ...state, openTurn: { ...open, text } }
    }
    case 'tool/call': {
      const { turn, name } = event.data as { turn: number; name: string }
      const open = state.openTurn
      if (open === null || open.turn !== turn) return state
      if (open.tools.includes(name)) return state
      return { ...state, openTurn: { ...open, tools: [...open.tools, name] } }
    }
    case 'turn/end': {
      const { turn, reason } = event.data as { turn: number; reason: { kind: string } }
      const open = state.openTurn
      if (open === null || open.turn !== turn) return state
      return {
        openTurn: null,
        last: {
          turn,
          reason: reason.kind,
          body: open.text.trim(),
          tools: open.tools,
        },
      }
    }
    default:
      return state
  }
}

const valueSchema = z.object({
  turn: z.number().int().nonnegative(),
  reason: z.string(),
  body: z.string(),
  tools: z.array(z.string()),
}).strict()

// The cast bridges only the readonly modifier: the plain-object output is
// mutable, the public state interface is readonly.
const stateSchema: z.ZodType<NotificationProjectionState> = z.object({
  openTurn: z.object({
    turn: z.number().int().nonnegative(),
    text: z.string(),
    tools: z.array(z.string()),
  }).strict().nullable(),
  last: valueSchema.nullable(),
}).strict() as unknown as z.ZodType<NotificationProjectionState>

/** Projection definition with non-optional wire for the registered notification key. */
type NotificationProjectionDefinition = ProjectionDefinition<'notification', NotificationProjectionState> & {
  wire: NonNullable<ProjectionDefinition<'notification', NotificationProjectionState>['wire']>
}

/**
 * Build the `notification` projection unit.
 * @param config - resolved plugin configuration (body budget).
 * @returns the projection definition registered on the projection seam.
 */
export function notificationProjection(config: ResolvedConfig): NotificationProjectionDefinition {
  return {
    key: 'notification',
    stateSchema,
    init: () => ({ openTurn: null, last: null }),
    apply: (state, event) => applyProjectionEvent(state, event as unknown as NotificationEvent, config.maxBodyChars),
    wire: {
      viewSchema: valueSchema,
      view: state => state.last ?? EMPTY_PROJECTION,
    },
    stateVersion: 1,
  } satisfies ProjectionDefinition<'notification', NotificationProjectionState>
}
