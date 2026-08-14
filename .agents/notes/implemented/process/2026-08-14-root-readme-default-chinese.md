# Agent Note: Root README defaults to Chinese on GitHub

Status: implemented

English | [中文](2026-08-14-root-readme-default-chinese.zh.md)

## Problem

GitHub renders only the root `README.md` on a repository's front page. The pair kept English in `README.md` and Chinese in `README.zh.md`, so the fork's GitHub page defaulted to English. The fork owner wants the front page to default to Chinese, with English one link away.

## Decision

The root README pair is swapped: `README.md` now holds the Chinese content and the English counterpart is `README.en.md`. The switcher lines read `[English](README.en.md) | 中文` on the Chinese side and `English | [中文](README.md)` on the English side.

The root README pair is excluded from the mechanical bilingual pairing gate: `README.md` is added to the exclusion list in `scripts/translation-pairing.manifest.json`, and `README.i18n.yaml` is deleted (an excluded file must have no `.zh.md` and no `.i18n.yaml`). `README.en.md` never enters the pairing scope anyway, because the discovery regex `README_ARTIFACT` matches only `.md`, `.zh.md`, and `.i18n.yaml` basenames. The pair stays bilingual and is maintained manually; the exclusion is recorded in the pairing contract's scope section (docs/i18n/README.md, both languages) and the sync-conflict handling in CUSTOM-FEATURES.md.

The pairing machinery's English-source convention — English is the unsuffixed `foo.md`, Chinese is `foo.zh.md` — is unchanged for every other document in the corpus.

The prompt pipeline follows the swap: the example pair in `scripts/verify-translation-prompt.ts`, the gold-pair list and switcher illustration in `docs/i18n/translation-prompt.md`, and the recorded prompt snapshot now name `README.en.md` ↔ `README.md`. The few-shot contents are the same documents as before the swap, so rendered prompts are byte-identical; the snapshot was re-recorded for the name changes only. Inbound README anchor links in four doc pairs now target `README.en.md` (`#run`, `#run-from-source`).

Two fork packages whose READMEs lacked gate-conformant structure gained audited sentence-form entries in `verify-package-readme-model-experience.ts` (`ui-resend-failed-round`, `ui-session-reference`) and canonical `## Model Experience` / `## Known Limitations and Deferred Work` sections. Pre-existing pairing-gate debt elsewhere was completed in the same change: the desktop README pair lacked its consistency record and both switchers; the ui-theme README pair was out of sync; the two plugin READMEs hard-wrapped prose. The corpus-wide pairing gate passes 942 pairs.

## Alternatives considered

- **Generalize the pairing tooling to a `.en.md` counterpart.** Teach discovery, pair-role resolution, the merge driver, and the brief generator that Chinese may occupy the unsuffixed side. That reworks five scripts plus their specs and the contract docs for a single fork-owned front page, while every other corpus document keeps the English-source convention.
- **Swap contents but keep the file names** (English inside `README.zh.md`). The gate would pass mechanically, but the filename would lie about its language and confuse every future maintainer and tool.
- **Exclude the pair from the gate** (chosen). The front page is fork policy, not corpus policy; the pair remains bilingual and manually maintained, and the deviation is documented in the contract instead of silently weakening the gate.

## Consequences

- The fork's GitHub page now renders Chinese by default.
- The pairing machinery itself is untouched; the prompt example paths, two package README audit entries, stale records, and the prompt snapshot were updated alongside, and the corpus-wide gate passes (942 pairs).
- The root README pair loses its mechanical consistency check and its recorded-hash recovery pointer; keeping the two sides in sync is manual from now on.
- Every upstream sync conflicts on `README.md` (upstream English vs fork Chinese) and `README.zh.md` (upstream file vs fork deletion); CUSTOM-FEATURES.md documents the resolution.
