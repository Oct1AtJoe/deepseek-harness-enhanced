# Agent Note: Failed-round resend — 重新发起 action on the user bubble

Status: implemented

English | [中文](2026-08-14-failed-round-resend.zh.md)

## Problem

When a turn fails terminally (`turn/end` with an error reason) or ends at the output-token cap, the chat flow shows the failure notice but offers no way to retry the round. The composer only sends what the user types next; retrying means manually re-typing or copy-pasting the original message. The user bubble's action row carries copy (and branch under assistant answers); the [dropped edit stub](../simplification/2026-07-31-drop-user-message-edit-stub.md) shows the row is the established home for per-message actions, but no affordance restarts the failed round.

## Decision

The last user message whose following turn failed terminally carries a 重新发起 (resend) icon button beside the copy button. Clicking it re-sends the message's plain text as a queued turn through the existing `IConversation.send` path — the same `session.prompt([{ type: 'text', text }], 'queue')` the composer uses — so retry semantics (queueing while busy, `promptError` surfacing) are identical to a fresh send.

### Eligibility derivation, view-local

`ChatView` derives the resend target with a `useMemo` over the stable chat `order` and the live node store: scan the ordered visible nodes, remember the last `user` node (and its plain text), and flag failure when a `turn-error` or `turn-max-tokens` node appears after it. A later user message resets the flag, so the action only ever addresses the round that actually failed last. The scan is O(n) over order and order only changes on row enter/leave/move, so content deltas never recompute it. `running` hides the action: a live turn is not a dead round, and hiding on resend gives click feedback when the retry starts.

### Plumbing through the existing slot contract

`ChatViewInjected` gains `resend(text)`, implemented in `apply.ts` as `scoped.send(text)` with the rejection swallowed (send failures already surface through the session `promptError` strip). `ChatNodeOwnerProps` gains an optional `onResend` callback; `ChatNodeSeat` threads it from `ChatView` (stable `useCallback` keyed on the target, so only the eligible seat re-renders), and `UserMessageNodeView` hands it to `MessageIconActions`, which renders the refresh icon (`IconRefreshOutline16`, already in ui-primitives) with a `message.resend` tooltip between copy and the extra-actions seat. No snapshot field, no new node kind, no runtime contract change: the derivation is presentation-only over existing data.

### Scope limits

Only plain text is re-sent — image blocks in the original message are not replayed (same limitation the queue editor already documents for non-text content). The action addresses only the last failed round: an older failure followed by a newer user message is no longer eligible, matching "重新发起这一轮" rather than an arbitrary replay. A `model-retry` chain suppresses the `turn-error` node (hidden visibility), so an auto-retry in progress shows no manual resend — the host-owned retry already owns the round.

## Alternatives considered

- **Correlate by turn number** — `TurnErrorNode` carries a turn, but `UserMessageNode` does not, and `user/message` events land outside turn locations; positional ordering is the only reliable correlation and is cheaper than reworking the location index.
- **Resend through the composer machine** — the input machine owns draft state and submit gestures; the message action needs a direct send, which `IConversation.send` already provides without touching draft persistence.
- **Include image blocks** — durable attachments could be re-referenced, but the queue editor already refuses non-text edits and re-uploading browser drafts after reload is a separate feature; text-only matches the established limitation.
- **Show on every failed user message** — re-sending a mid-conversation old round appends a duplicate turn after the newer context; the last-failed-round rule keeps the action unambiguous.

## Consequences

The failed-round recovery path no longer depends on the user re-typing the message; the action is discoverable exactly where the round's own message sits. Because the resend rides `IConversation.send`, all existing send semantics (queue mode, `promptError` failure surfacing, blank-session flip) apply unchanged. The derivation lives in the view and adds no snapshot surface, so replay and window rebuild are unaffected; the keyless replay web e2e and the `chat-view`/`apply-inject` specs pin the behavior (button presence on `turn-error` and `turn-max-tokens` tails, absence on healthy tails, disappearance after a newer user message or while running, and the exact re-sent text through the inject face).
