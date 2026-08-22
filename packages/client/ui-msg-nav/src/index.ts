/**
 * Host half of dsh-client-ui-msg-nav: registers the `msgNavMessages` session
 * projection unit so the browser rail gets the complete user-message list
 * instantly (history tail page + session/projection push frames) without the
 * client pulling history pages one by one.
 */
import { z } from 'zod'
import type { Context } from '@deepseek-ai/cordis'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'

const PROJECTION_KEY = 'msgNavMessages'

/**
 * Cap preview text so projection payloads stay small.
 */
const MAX_TEXT_CHARS = 200

function textOf(content: ReadonlyArray<unknown>): string {
  let out = ''
  let hasImage = false
  for (const block of content) {
    if (block !== null && typeof block === 'object') {
      const b = block as Record<string, unknown>
      if (b.type === 'text' && typeof b.text === 'string') out += b.text
      else if (b.type === 'image') hasImage = true
    }
  }
  const cleaned = out.replace(/^\s*<\s*goal_[a-z_]*\s*>\s*/i, '')
  const trimmed = cleaned.trim().slice(0, MAX_TEXT_CHARS)
  return trimmed !== '' ? trimmed : (hasImage ? '[图片消息]' : '')
}

/** One user message in the wire list: identity, order, and a capped preview. */
export interface MsgNavEntry {
  seq: number
  time: number
  text: string
  id?: string | undefined
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    /** Whole-log user-message list for the navigation rail (host fold == wire view). */
    msgNavMessages: MsgNavEntry[]
  }
  interface SessionProjectionMap {
    /** Whole-log user-message list for the navigation rail. */
    msgNavMessages: MsgNavEntry[]
  }
}

const msgNavEntrySchema = z.object({
  seq: z.number(),
  time: z.number(),
  text: z.string(),
  id: z.string().optional(),
}).strict()
const msgNavListSchema = z.array(msgNavEntrySchema)

export const msgNavProjectionDefinition = {
  key: PROJECTION_KEY,
  stateVersion: 1,
  stateSchema: msgNavListSchema,
  init: (): MsgNavEntry[] => [],
  apply: (state: MsgNavEntry[], event) => {
    if (event.type !== 'user/message') return state
    if (event.data.source.kind !== 'user') return state
    const entry: MsgNavEntry = { seq: event.seq, time: event.time, text: textOf(event.data.content) }
    if (event.data.id !== undefined) entry.id = event.data.id
    return [...state, entry]
  },
  wire: { viewSchema: msgNavListSchema, view: (state: MsgNavEntry[]) => state },
} satisfies ProjectionDefinition<typeof PROJECTION_KEY, MsgNavEntry[]>

/**
 * Register the projection unit when the projection registry exists.
 * @param ctx - host plugin context.
 */
export function apply(ctx: Context): void {
  ctx.inject(['sessionProjections'], (projectionCtx) => {
    projectionCtx.sessionProjections.register(msgNavProjectionDefinition)
  })
}
