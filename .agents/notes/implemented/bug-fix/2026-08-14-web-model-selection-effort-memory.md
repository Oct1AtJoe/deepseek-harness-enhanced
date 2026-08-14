# Agent Note: Per-model effort memory in the Web model picker

Status: implemented

English | [中文](2026-08-14-web-model-selection-effort-memory.zh.md)

## Problem

`session.selectModel` treats a payload without `reasoningEffort` as the model's adapter default. The Web picker's model rows submit no effort, so setting deepseek-v4-flash to `max`, switching to another model, and switching back re-materializes flash's default `high`: the explicit effort choice is lost the moment the session selection leaves that route. The session selection is one slot and the stored Agent default is one selection, so neither can hold a per-model preference, and a new session starts with no memory of the choice at all.

## Decision

The Host persists a per-route effort memory in the `agent-default-model` settings section (`efforts: { "provider/model": effort }`) and applies it everywhere a selection names no effort: `session.selectModel` resolves a bare pick through the remembered effort before the adapter default, and `AgentDefaultModelConfig.currentSelection()` composes it into the default a new session starts from. An explicit `reasoningEffort` records the route's memory; an empty string explicitly clears it (the provider-default row in the picker sends `''`), so "adapter default" stays reachable. A remembered effort the model no longer supports falls back to the adapter default and forgets itself rather than blocking the switch.

The picker submits bare provider/model selections and lets the Host resolve the effort, so both entries (`/model` popup and the composer seat) get the memory for free and never record incidental default materialization as a preference. The wire contract grows one meaning, not one field: the `session.selectModel` request schema accepts `''` as the clear signal; `RpcMethodMap` types are unchanged.

## Alternatives considered

**Client-side picker memory.** The first cut kept per-route efforts on the `ModelDirectory` (localStorage-persisted in the second cut). It fixed switching away and back within one page but could not fix a new session's initial display — that comes from the Host default — and a page reload or different browser forgot choices. The effort preference is model-visible state, which the Host owns.

**A separate clear flag on the wire.** `clearReasoningEffort: true` is more explicit than the `''` sentinel but adds a field and a typed method-shape change; `''` reuses the existing optional string with one documented meaning.

## Consequences

A chosen effort follows the model into every session and survives restarts, stored with the host settings. Explicit picks record the preference; bare picks and new sessions apply it; the provider-default row clears it. The stale-memory fallback keeps model switching working after a deployment narrows a model's supported efforts. The memory is per host (settings document), not per browser or per user account.
