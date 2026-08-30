# local-patches — local patch replay

English | [中文](README.zh.md)

Preserves local changes maintained on top of the official upstream (deepseek-ai/deepseek-harness). After a sync from upstream (merge or rebase) overwrites or drops those changes, one command in the repository root re-applies them:

```sh
bash local-patches/apply-local-patches.sh
```

## Behavior

- The script applies a patch when the working tree accepts it cleanly.
- It skips a patch already present in the working tree (the reverse check passes), so reruns are safe.
- When both checks fail it reports CONFLICT and exits non-zero: repair by hand, usually because upstream modified the same region — merge the patch's intent manually and regenerate the patch file.

The script locates the repository root itself, so every git operation runs there. Files that a patch adds (such as Agent Notes) stay untracked; include them in the next commit.

## Current patches

- `2026-08-29-windows-acl-error-mode-suppression-pair.patch` — the Windows ACL runner two-bit crash-dialog suppression fix (`SEM_NOGPFAULTERRORBOX | SEM_FAILCRITICALERRORS` kept as a pair), matching the same-named Agent Note under `.agents/notes/implemented/bug-fix/`.

## Maintenance conventions

- A patch file shares its name with the corresponding Agent Note.
- After changing a local fix, regenerate its patch and commit it:

  ```sh
  git add -N <new-files...>
  git diff -- . ':(exclude)vendor/**' > local-patches/<patch-name>.patch
  ```

- Delete a patch file once upstream has adopted that fix.
- This directory is fork-maintainer-local tooling and stays out of upstream PRs.
