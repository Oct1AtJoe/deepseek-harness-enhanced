/**
 * Session-reference plugin, browser half: registers the '@' session source —
 * candidates from the session.referenceCandidates RPC (every workspace,
 * ranked by host-side working-directory affinity; the calling session is
 * excluded). A pick inserts a reference occurrence whose model form is the
 * canonical `@[label](dsh-session:…)` mention; the host prompt boundary
 * (@deepseek-ai/dsh-host-apiproxy) strips the mention into readable content
 * and injects the referenced session's bounded, read-only snapshot into the
 * same model step. Cross-session snapshots carry an untrusted-data guard in
 * their prompt prefix, so the mention cannot smuggle instructions or tool
 * calls into the current session.
 *
 * Candidates are fetched per keystroke (the resolver's corpus read is
 * bounded by its candidate limit and the pipeline supersedes in-flight
 * fetches via the request signal). The menu hands back the exact candidate
 * objects this source created, so a WeakMap recovers the opaque session id
 * at pick time without shipping it through the menu contract.
 */
import type { ConnectionHandle, SessionId } from '@deepseek-ai/dsh-api-remotes/client'
import type { ClientContext, ISessions } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  InputTriggerCandidate, InputTriggerServiceContract, InputTriggerSource,
} from '@deepseek-ai/dsh-client-ui-input-trigger/client'

const SESSION_REFERENCE_SCHEME = 'dsh-session:'

/**
 * Canonical `dsh-session:` URI payload: base64url of the JSON string id —
 * the same alphabet as the shared resolver URI, computed without Node's
 * Buffer because this bundle runs in the browser.
 * @param sessionId - opaque session id to serialize.
 * @returns `dsh-session:<base64url>` URI.
 */
function encodeSessionReferenceUri(sessionId: string): string {
  const payload = btoa(JSON.stringify(sessionId))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '')
  return `${SESSION_REFERENCE_SCHEME}${payload}`
}

/** Mirror of the resolver's label escaping: `\` and `]` are backslash-escaped. */
function escapeLabel(label: string): string {
  return label.replace(/[\\\]]/gu, match => `\\${match}`)
}

/** Model form of one session reference: `@[label](dsh-session:…)`. */
function sessionReferenceMention(sessionId: string, label: string): string {
  return `@[${escapeLabel(label)}](${encodeSessionReferenceUri(sessionId)})`
}

/** Required services: the reference-source registry, the connection, and the session list. */
export const inject = ['inputTriggers', 'connection', 'sessions']

/**
 * Client plugin body: register the '@' session source.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const api = (ctx.get('connection') as ConnectionHandle).api
  const sessions = ctx.get('sessions') as ISessions
  // Pick-time recovery: candidate → opaque session identity (display
  // metadata rides the candidate itself; identity rides this WeakMap).
  const byCandidate = new WeakMap<InputTriggerCandidate, { sessionId: SessionId; label: string }>()
  // Label by reference id so the codec can render the title inside the
  // mention (serialize receives only the ref; the labels are best-effort).
  const labelByRef = new Map<string, string>()

  const source: InputTriggerSource = {
    trigger: '@',
    name: 'session',
    // Sessions outrank subagents in the '@' menu.
    order: -1,
    async candidates(session, { query, signal }) {
      if (sessions.subagentAddress(session.sessionId) !== undefined) return []
      const { result } = await api.sessions.referenceCandidates(
        { sessionId: session.sessionId, query },
        signal,
      )
      if (!result.ok || signal.aborted) return []
      // Menu rows are keyed by candidate name: duplicate titles get a short
      // id suffix while unique labels stay clean.
      const counts = new Map<string, number>()
      for (const candidate of result.value.candidates) {
        counts.set(candidate.label, (counts.get(candidate.label) ?? 0) + 1)
      }
      return result.value.candidates.map((candidate) => {
        const unique = (counts.get(candidate.label) ?? 0) === 1
        const item: InputTriggerCandidate = {
          name: unique ? candidate.label : `${candidate.label} (${candidate.sessionId.slice(0, 8)})`,
          ...(candidate.cwd === undefined ? {} : { description: candidate.cwd }),
        }
        labelByRef.set(candidate.sessionId, candidate.label)
        byCandidate.set(item, { sessionId: candidate.sessionId, label: candidate.label })
        return item
      })
    },
    onPick({ candidate }) {
      const entry = byCandidate.get(candidate)
      if (entry === undefined) return undefined
      return {
        insert: {
          source: 'session',
          ref: entry.sessionId,
          label: entry.label,
          clipboardText: `@${entry.label}`,
        },
      }
    },
    codec: {
      clipboardText: ref => `@${ref}`,
      // The model form is the canonical mention the host prompt boundary
      // parses and strips; failure here blocks the send (never a silent
      // downgrade to the clipboard text).
      serialize: (ref, _signal) => Promise.resolve(
        sessionReferenceMention(ref, labelByRef.get(ref) ?? ref),
      ),
    },
  }
  const inputTriggers = ctx.get('inputTriggers') as InputTriggerServiceContract
  ctx.effect(() => inputTriggers.registerSource(source), 'ui-session-reference: @ source')
}
