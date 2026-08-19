# Agent Note: Applied diff hunks carry only the change lines

Status: implemented

English | [中文](2026-08-19-diff-hunks-carry-change-lines-only.zh.md)

## Problem

A write or edit turn displayed `+A -R` line totals that did not match the change it applied, and the diff card rendered unchanged context as both a deletion and an addition.

`computeHunkDiffs` in `packages/fs/tool-fs/src/diff.ts` built each applied hunk through `structuredPatch(..., { context: 3 })` and pushed every context (unchanged) line into **both** `oldText` and `newText`. The web `DiffBlock` (the official `ui-primitives` copy and the `ui-deliverables-custom` fork) draws every `oldText` line as a removed row and every `newText` line as an added row, and counts them all. The render-intent contract's `FileDiff` shape has no way to mark a line as context, so the 3-line context each side became three phantom deletions plus three phantom additions per hunk. A real `-4 +9` function replacement read `-13 +18` when the surrounding region supplied enough context, and the same unchanged lines showed twice — once red, once green.

## Decision

`computeHunkDiffs` no longer requests context from `structuredPatch` (`context: 0`), so each hunk's `oldText` and `newText` carry exactly the removed and added lines. A UI can therefore count `+A -R` straight from the two texts, and the diff card shows only the change. This aligns `write`/`edit` with `str_replace_editor`, whose call view already reports the bare `old_str`/`new_str` block with no context. `DIFF_CONTEXT` is removed.

The persisted `tool/result` `meta` carries the same hunk shape, so replay and live rendering agree; already-recorded sessions keep their recorded hunks. The change-only hunk never crosses the byte/length bounds that the whole-file fallback exists for, so `write`'s `before: null` bound behavior is untouched.

## Alternatives considered

**Keep context and mark unchanged lines.** The `FileDiff` shape would gain a per-line kind or a parallel unchanged-side field. Rejected as the wrong size: it changes a wire contract shared across the tool seam, `str_replace_editor`, session persistence, and every renderer for a visual nicety the shape currently cannot express.

**Count only the lines differing between `oldText` and `newText` in the renderer.** The client cannot distinguish a context line from a changed line once the two blobs have context merged in; re-diffing in the browser re-implements the host's hunk logic and still misreads a changed line whose text coincides with context. The host knows the line kinds, so the host is the place to drop context.

**Strip context in the custom panel only.** Fixes one surface while the official tool-row card stays wrong; the root is shared, so the fix lives at the shared producer.

## Consequences

Diff cards and the produced-files `+A -R` badges now report the applied change's own line totals. The `+N file(s)` footer and the distinct-file count are unchanged.

Recording a turn's `meta` now stores smaller, exact hunks; older logs replay their recorded hunks verbatim, so history keeps its original numbers.

The diff card no longer offers surrounding context for locating a change inside the file. The card is a summary of what changed, and the model-facing tools return the full current file on `read`, so the dropped context is recoverable by the reader. If a future renderer wants neutral context rows, that is a new `FileDiff` shape, not a reload of this bug.

## Testing

`packages/fs/tool-fs/tests/diff.spec.ts` pins the change-only hunks: a single-line change yields `oldText: 'line4'` / `newText: 'CHANGED'`, scattered replacements stay separate hunks, and a no-context assertion replaces the old `DIFF_CONTEXT` test. `packages/fs/tool-fs/tests/tools.spec.ts` pins the applied `meta` and result view for edit and write-overwrite as the bare `OLD`/`NEW` block. The client suites (`ui-primitives` DiffBlock, `ui-deliverables-custom`) and the assembled-boot snapshot pass unchanged, since a create's `oldText: null` hunk and the distinct-file counting never depended on context.

## Related

- [Web diff card](../feature/2026-07-30-web-diff-card.md) — the feature that carried the applied hunks to the browser; this fix corrects the hunks that result view carries.
