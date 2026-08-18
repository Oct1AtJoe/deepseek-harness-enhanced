/**
 * Client-side notification rendering: the pure parts (title/body/gating) split
 * out for unit tests, while the `Notification` construction stays in the thin
 * runner wired by the plugin body.
 */
import type { NotificationReason, PendingKind } from '../contract.ts'

/** The reason title key for one turn-end reason. */
export function titleKey(reason: NotificationReason): 'notify.titleCompleted' | 'notify.titleError' | 'notify.titleAborted' | 'notify.titleBlocked' | 'notify.titleMaxTokens' {
  switch (reason) {
    case 'completed': return 'notify.titleCompleted'
    case 'error': return 'notify.titleError'
    case 'aborted': return 'notify.titleAborted'
    case 'blocked': return 'notify.titleBlocked'
    case 'max-tokens': return 'notify.titleMaxTokens'
  }
}

/** The title key for one pending interaction. */
export function pendingTitleKey(kind: PendingKind): 'notify.titleApproval' | 'notify.titleQuestion' | 'notify.titlePlanReview' {
  switch (kind) {
    case 'approval': return 'notify.titleApproval'
    case 'question': return 'notify.titleQuestion'
    case 'plan-review': return 'notify.titlePlanReview'
  }
}

/** The notification body: the reply snippet, or the empty-body fallback. */
export function bodyText(body: string, emptyBody: string): string {
  const trimmed = body.trim()
  return trimmed === '' ? emptyBody : trimmed
}

/**
 * Whether a completion should surface a desktop notification, given the browser
 * permission, the background-only preference, page visibility, and whether
 * the completed session is the one currently in view.
 */
export function shouldShow(
  permission: NotificationPermission,
  backgroundOnly: boolean,
  documentHidden: boolean,
  completedSessionId?: string,
  currentSessionId?: string,
): boolean {
  if (permission !== 'granted') return false
  if (backgroundOnly && !documentHidden && completedSessionId === currentSessionId) return false
  return true
}

/**
 * The grouping tag: one notification slot per session per turn. Turn-scoped
 * (not session-scoped): the browser replaces same-tag notifications, and a
 * stale same-tag entry lingering in the Windows notification center silently
 * swallows every later notification with that tag — a per-turn tag guarantees
 * each completed turn's toast always shows.
 */
export function notificationTag(sessionId: string, turn: number): string {
  return `dsh-notification-${sessionId}-${turn}`
}

/** A unique tag for each pending interaction notification in one session. */
export function pendingNotificationTag(sessionId: string, sequence: number): string {
  return `dsh-notification-pending-${sessionId}-${sequence}`
}

/** The surface this code may show notifications on (absent in insecure contexts). */
export function notificationsApi(): typeof Notification | undefined {
  return typeof Notification === 'undefined' ? undefined : Notification
}

/** Notification options plus the plugin-private wire field the desktop shell's shim reads. */
export interface BridgeNotificationOptions extends NotificationOptions {
  /**
   * The session that produced this notification: clicking it opens that session
   * in the GUI. The Tauri shell (injected `window.Notification` shim) forwards
   * it to the shell's toast bridge; standard browsers ignore the unknown key.
   */
  readonly sessionId?: string
}

/**
 * Assemble the options passed to `new Notification`, attaching the session id
 * when known. The shim/bridge path reads `options.sessionId` at construction
 * time; native browsers just ignore it.
 */
export function notificationOptions(body: string, tag: string, requireInteraction: boolean, sessionId?: string): BridgeNotificationOptions {
  return { body, tag, requireInteraction, ...(sessionId === undefined ? {} : { sessionId }) }
}
