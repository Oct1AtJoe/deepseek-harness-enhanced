# Agent Note: Keep both error-mode suppression bits through the Windows ACL runner

Status: implemented

English | [中文](2026-08-29-windows-acl-error-mode-suppression-pair.zh.md)

## Problem

A desktop deployment reported that under the `workspace-write` session policy commands succeed while a `cmd.exe` "Application Error" dialog appears on the desktop. The crash surfaces carry no WER event, no reliability record, and no ReportArchive entry, which identifies the dialog as the CSRSS hard-error box for process-initialization failure (`0xC0000142`-class) rather than a WER-reported crash. Two suppression layers already exist — the inherited `SetErrorMode` bits and the `dsh-sandbox-policy` registry keys (`DontShowUI` + `ExcludedApplications`, verified present on the host) — and the dialog still appeared, so the WER layer cannot reach this box and the error-mode layer was the remaining candidate.

The server sets `SEM_NOGPFAULTERRORBOX | SEM_FAILCRITICALERRORS` at startup (`dsh-sandbox-windows-acl/src/index.ts`), and children created without `CREATE_DEFAULT_ERROR_MODE` inherit the caller's current mode. But `SetErrorMode` is a replace, not an OR: the runner re-set only `SEM_NOGPFAULTERRORBOX` at module load and again in `main()`, which cleared the inherited `SEM_FAILCRITICALERRORS` bit. Every confined child then inherited a one-bit mode — the process-tree-wide suppression the server intended was silently downgraded at exactly the hop that spawns the confined tree.

## Decision

Both runner `setErrorMode` call sites now set `SEM_NOGPFAULTERRORBOX | SEM_FAILCRITICALERRORS` together, with the replace semantics documented at each site; the spawn sites' inheritance comments name both bits. The runner suite pins the contract end to end: a confined child reads its own mode back through `GetErrorMode` (koffi) and the assertion masks off `SEM_NOOPENFILEERRORBOX`, which modern Windows always reports regardless of what `SetErrorMode` wrote. The package README records the two-bit inherited contract beside the other verified boundaries.

A targeted experiment with the empirically always-failing form (restricted token + `CREATE_NO_WINDOW`, the win32-abi-documented `0xC0000142` shape) died silently under both candidate modes on the investigation host, so the fix is proven to restore the intended suppression surface, not yet proven to remove the reporter's dialog: that dialog's exact trigger lives inside an arbitrary command chain's derived `cmd.exe` and did not reproduce in console-host, no-console-host, or probe shapes. The repair closes the one defect the evidence did establish; if a dialog still appears on the desktop, the next datum needed is the exact command that triggers it.

## Alternatives considered

**Rely on the WER registry layer.** Already active (`DontShowUI=1`, `cmd.exe` excluded, verified on the host) and demonstrably insufficient: the dialog left no WER trace at all, so the hard-error path bypasses WER entirely.

**Pass `CREATE_DEFAULT_ERROR_MODE`.** Rejected: the child would take the system default mode instead of inheriting the caller's bits, losing even `SEM_NOGPFAULTERRORBOX` and widening the dialog window rather than narrowing it.

**Fix the triggering command.** Rejected for now: the `cmd.exe` is derived by the executed command chain (`.cmd`/`.bat` shims, internal `cmd /c` calls), which the harness does not control; the error-mode contract is the one layer that covers every such descendant.

## Consequences

The confined process tree keeps both suppression bits end to end, and the suite fails if a future runner change downgrades the mode again. Dialogs outside the two bits' coverage — if any reach the desktop — need their own trigger identified before they can be suppressed further; the investigation artifacts (WER registry state, event-log absence, reproduction shapes) are recorded here as the baseline for that follow-up.
