/**
 * Turn-scoped produced-file Definition and readers. Client-only and
 * model-free: the vocabulary is the mutation tools' own follow-along
 * `locations`, never the closing prose. Alongside the turn's produced
 * paths, each Turn publishes two change-history maps:
 * - `history` — conversation-cumulative (chained across Turns), drives
 *   the chip badge's `+N -M` totals.
 * - `turnHunks` — this Turn only (fresh each start), drives the
 *   expandable diff panel so a collapsed turn never shows accumulated
 *   changes from earlier Turns.
 */
import type {
  ConversationEventInput, ConversationNodeDefinition, ToolResultNode,
} from '@deepseek-ai/dsh-client-runtime/client'
import { isAppendSurfaceEvent } from '@deepseek-ai/dsh-client-runtime/client'
import type { MarkdownFileMentions } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TurnTailOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'

interface ProducedPath {
  readonly seq: number
  readonly path: string
}

/** One applied change's content pair, in the primitive's `DiffHunk` shape minus the path. */
export interface ProducedHunk {
  readonly oldText: string | null
  readonly newText: string
}

/** One produced path plus its conversation history, the row's per-chip input. */
export interface ProducedFileMatch {
  readonly path: string
  /** This turn's applied hunks for the path (shown in the expandable diff panel). */
  readonly hunks: readonly ProducedHunk[]
  /** Conversation-cumulative applied hunks for the path (shown in the chip badge). */
  readonly totalHunks: readonly ProducedHunk[]
}

/** Immutable produced-file facts published against one Turn. */
export interface DeliverablesTurnData {
  readonly produced: readonly ProducedPath[]
  /**
   * Conversation-cumulative applied hunks per path, in call order. Each
   * Turn's start chains the previous Turn's map, so a chip's badge can
   * show the total edits the conversation made to a file across all Turns.
   * A compacted window that drops the prior Turn simply restarts from empty.
   */
  readonly history: ReadonlyMap<string, readonly ProducedHunk[]>
  /**
   * This Turn's own applied hunks per path, in call order. Fresh each Turn
   * start (never chained), so the expandable diff panel shows only what
   * changed in the closing Turn, not the accumulated history.
   */
  readonly turnHunks: ReadonlyMap<string, readonly ProducedHunk[]>
}

declare module '@deepseek-ai/dsh-client-runtime/client' {
  interface ConversationTurnDataMap {
    /** Successful mutation paths accumulated in this Turn. */
    deliverables: DeliverablesTurnData
  }
}

interface DeliverablesState extends DeliverablesTurnData {
  readonly turn: number
  readonly calls: ReadonlyMap<string, ToolResultNode['callView']>
}

/**
 * Paths a call view reports having created or changed, by render intent rather
 * than tool name: a diff card, or a generic card whose kind is `edit` (the
 * shape `str_replace_editor`'s insert presents). Every other card produces
 * nothing to open — a read looked, a delete removed, a terminal ran. Only
 * root call views enter this Turn accumulator; nested Code Mode dispatches
 * preserve the pre-assembly behavior and do not contribute independently.
 * The caller guards the null call view before this runs.
 */
function producedPaths(view: Exclude<ToolResultNode['callView'], null>): readonly string[] {
  if (view.card === 'diff') return (view.locations ?? []).map(location => location.path)
  if (view.card === 'generic' && view.kind === 'edit') {
    return (view.locations ?? []).map(location => location.path)
  }
  return []
}

/** A change hunk as a tool view carries it (the contract's `FileDiff` shape). */
interface DiffLike {
  readonly path: string
  readonly oldText: string | null
  readonly newText: string
}

/**
 * The applied hunks of a settled mutation call, or null when neither view
 * carries a usable diff. The result view is authoritative — write/edit tools
 * return the APPLIED contextual hunks there — and the call view (the intended
 * change derived from the args) is the fallback when the result carries none
 * (a running call, a view that never arrives, a generic-error result). The
 * view crosses the wire and only its `card` string is validated upstream, so
 * like the diff-card model, malformed `diffs` narrow to null instead of
 * crashing the accumulator. The caller returns on a null call view — a result
 * whose call left no stored view (a window boundary) contributes nothing — so
 * this function only ever sees stored call views.
 * @param event - the settled `tool/result` match.
 * @param callView - the paired call view, already stored in the Turn state.
 * @returns the validated hunks, or null when unusable.
 */
function mutationDiffs(
  event: ConversationEventInput,
  callView: Exclude<ToolResultNode['callView'], null>,
): readonly DiffLike[] | null {
  // The result view is authoritative once the call settles: a diff card there
  // is the applied change, and a non-diff result (the tool chose the generic
  // card, e.g. an execution error kept off the diff path) carries no hunks.
  // Only when no result view arrives at all (a view that never crosses the
  // wire) does the call view's intended change stand in.
  const eventView = event.view?.for === 'result' ? event.view.view : undefined
  if (eventView !== undefined && eventView.card !== 'diff') return null
  const view = eventView?.card === 'diff' ? eventView : callView
  if (view.card !== 'diff') return null
  if (!Array.isArray(view.diffs) || view.diffs.length === 0) return null
  const out: DiffLike[] = []
  for (const hunk of view.diffs as unknown as unknown[]) {
    if (typeof hunk !== 'object' || hunk === null) return null
    const { path, oldText, newText } = hunk as Record<string, unknown>
    if (typeof path !== 'string' || typeof newText !== 'string') return null
    if (oldText !== null && typeof oldText !== 'string') return null
    out.push({ path, oldText, newText })
  }
  return out
}

/**
 * Files produced by one Turn data value.
 *
 * The source is the mutation tools' own follow-along `locations`, not the
 * closing prose: a produced file must be listed whether or not the model
 * remembered to name it. A mutation is recognized by render intent, not by
 * tool name — a diff card, or a generic card whose `kind` is `edit` (the shape
 * `str_replace_editor`'s insert presents) — so a new mutation tool joins by
 * declaring what it does. Reads contribute nothing (looking at a file does not
 * produce it), and neither do deletes (there is nothing left to open) or
 * failed calls. Paths keep first-seen order and appear once, so a file written
 * and then edited in the same turn is one entry.
 *
 * The Conversation Location index owns turn membership before this function
 * runs, so paths cannot spill across turns and this derivation does not infer
 * boundaries from neighboring presentation Nodes.
 * @param data - engine-published Deliverables data for one Turn.
 * @param seq - closing Assistant seq; later Tool settlements are excluded.
 * @returns Produced paths in first-seen order; empty when the turn wrote nothing.
 */
export function producedForClosing(
  data: Readonly<DeliverablesTurnData> | undefined,
  seq = Number.POSITIVE_INFINITY,
): readonly string[] {
  if (data === undefined) return []
  const paths: string[] = []
  const seen = new Set<string>()
  for (const produced of data.produced) {
    if (produced.seq > seq || seen.has(produced.path)) continue
    seen.add(produced.path)
    paths.push(produced.path)
  }
  return paths
}

/**
 * Claim the turn-tail chain only when its closing turn produced files.
 * @param owner - Turn-tail owner currency for the closing assistant.
 * @returns Produced matches (path plus conversation history) as the component's
 * input, or null to decline before mount.
 */
export function selectProducedFiles(owner: TurnTailOwnerProps): readonly ProducedFileMatch[] | null {
  const data = owner.turn.data.get('deliverables')
  const paths = producedForClosing(data, owner.seq)
  if (paths.length === 0) return null
  const history = data?.history
  const turnHunks = data?.turnHunks
  return paths.map(path => ({
    path,
    // Turn-scoped hunks for the expandable diff panel.
    hunks: turnHunks?.get(path) ?? [],
    // Conversation-cumulative hunks for the chip badge.
    totalHunks: history?.get(path) ?? [],
  }))
}

/**
 * Added/removed line totals for one path's conversation history, with the
 * same counting the diff primitive draws: every old-side content line
 * removed, every new-side content line added, empty text zero lines, and a
 * single trailing newline a terminator rather than an extra line.
 * @param hunks - the path's accumulated applied hunks.
 * @returns the `+added -removed` totals the chip badge shows.
 */
export function diffStats(hunks: readonly ProducedHunk[]): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const hunk of hunks) {
    added += sideLines(hunk.newText)
    removed += sideLines(hunk.oldText)
  }
  return { added, removed }
}

/** Content-line count of one diff side, following DiffBlock's terminator rule. */
function sideLines(text: string | null): number {
  if (text === null || text === '') return 0
  const body = text.endsWith('\n') ? text.slice(0, -1) : text
  return body.split('\n').length
}

/** Turn-local successful mutation accumulator; it publishes no view Node. */
export const deliverablesDefinition: ConversationNodeDefinition<DeliverablesState> = {
  kind: 'deliverables',
  match: (event) => {
    if (event.type === 'turn/start') return { id: String(event.data.turn), role: 'start' }
    if (event.type === 'tool/call') return { id: String(event.data.turn), role: 'update' }
    if (event.type === 'tool/result' && isAppendSurfaceEvent(event)) {
      return { id: String(event.data.turn), role: 'update' }
    }
    return null
  },
  start: (_context, match, reader) => {
    if (match.event.type !== 'turn/start') throw new Error('deliverables start requires turn/start')
    const previous = reader.previous<DeliverablesState>('deliverables')
    return {
      turn: match.event.data.turn,
      calls: new Map(),
      produced: [],
      // Chain the previous Turn's conversation history for the cumulative
      // badge; a fresh conversation or compacted window drops it to empty.
      history: new Map(previous?.state.history ?? []),
      // Turn-scoped hunks start fresh every Turn — the expandable diff
      // panel never shows accumulated changes from earlier Turns.
      turnHunks: new Map(),
    }
  },
  update: (context, match) => {
    if (match.event.type === 'tool/call') {
      const calls = new Map(context.state.calls)
      calls.set(
        String(match.event.data.callId),
        match.view?.for === 'call' ? match.view.view : null,
      )
      return { ...context.state, calls }
    }
    if (match.event.type !== 'tool/result') return context.state
    const result = match.event.data.message.content[0]
    if (result.isError === true) return context.state
    const callId = String(match.event.data.message.source.callId)
    const view = context.state.calls.get(callId) ?? null
    // A result whose call left no stored view (a window boundary) contributes
    // nothing; the mutationDiffs contract then sees a non-null call view.
    if (view === null) return context.state
    const additions = producedPaths(view)
      .map(path => ({ seq: match.event.seq, path }))
    if (additions.length === 0) return context.state
    const diffs = mutationDiffs(match, view)
    const history = new Map(context.state.history)
    const turnHunks = new Map(context.state.turnHunks)
    for (const produced of additions) {
      const hunks = diffs === null
        ? []
        : diffs.filter(diff => diff.path === produced.path)
          .map(({ oldText, newText }) => ({ oldText, newText }))
      if (hunks.length === 0) continue
      history.set(produced.path, [...(history.get(produced.path) ?? []), ...hunks])
      turnHunks.set(produced.path, [...(turnHunks.get(produced.path) ?? []), ...hunks])
    }
    return { ...context.state, produced: [...context.state.produced, ...additions], history, turnHunks }
  },
  buildLocationData: (context, scope) => scope !== 'turn' || context.state === undefined
    ? null
    : {
      kind: 'turn',
      turn: context.state.turn,
      key: 'deliverables',
      value: { produced: context.state.produced, history: context.state.history, turnHunks: context.state.turnHunks },
    },
}

/**
 * Trailing path segment, the part that identifies the file at a glance.
 * @param path - Slash- or backslash-separated path.
 * @returns The final segment, or the whole string when separator-free.
 */
export function basename(path: string): string {
  const at = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return at === -1 ? path : path.slice(at + 1)
}

/**
 * Leading path segments, the location that sets a deep path apart.
 * @param path - Slash- or backslash-separated path.
 * @returns The segments before the final one, or the empty string when separator-free.
 */
export function dirname(path: string): string {
  const at = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return at === -1 ? '' : path.slice(0, at)
}

/**
 * File-mention vocabulary over one turn's produced paths, for the closing
 * message's prose: an inline-code token opens the file it names. A token
 * resolves by exact path, or by being exactly the basename of exactly one
 * produced path — a basename two paths share stays inert rather than
 * guessing, so a mention link can never open the wrong file or 404.
 * @param paths - The turn's produced paths (tool order, already deduped).
 * @param openFile - The chat view's file opener.
 * @param label - Localizes the accessible open-label for a resolved path.
 * @returns The resolver MarkdownText consumes; the full path rides `title`,
 * the same disambiguator the row's chips carry.
 */
export function producedFileMentions(
  paths: readonly string[],
  openFile: (path: string) => void,
  label: (path: string) => string,
): MarkdownFileMentions {
  return {
    resolve(value) {
      const path = paths.includes(value) ? value : onlyPathWithBasename(paths, value)
      if (path === undefined) return undefined
      return { open: () => { openFile(path) }, label: label(path), title: path }
    },
  }
}

/** The single produced path whose basename is exactly `value`, else undefined. */
function onlyPathWithBasename(paths: readonly string[], value: string): string | undefined {
  const matches = paths.filter(path => basename(path) === value)
  return matches.length === 1 ? matches[0] : undefined
}
