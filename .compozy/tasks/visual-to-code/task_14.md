---
status: pending
title: "Task 14: Canvas undo of model edits in VSCode"
type: feature
complexity: high
---

# Task 14: Canvas undo of model edits in VSCode

## Overview

Ctrl+Z / Ctrl+Shift+Z on the VSCode preview canvas undo and redo model edits, and the
manual-layout snapshot stays in sync. Owner decision Q8, 2026-10-18; ADR-004.

## Shippable Outcome

- Outcome: `LikeC4ModelChanges` records history with an LSP connection too, and undo/redo restore
  through one `WorkspaceEdit`, returning `modifiedUris`. The extension forwards undo/redo requests
  from the preview and saves the modified documents. The preview port implements
  `undoModelChange` / `redoModelChange`.
- Verify in this task: the specs below, plus E2E-009 (dev server) and the VSCode manual check of
  US-018.
- Integration verification: the cross-feature VSCode pass is owned by task 15.

## Requirements

- `adrs/adr-004.md`; `_spec.md` Business Rule 14, Safety Invariant 3; `_dx.md` undo/redo request
  section; `_user_stories.md` US-018 (and US-006.EC-4).
- Remove the `Connection` guards in `recordHistory` and `restore`; keep the `stale-undo` check
  and the per-project queue.
- The preview port must throw on failure, like `handleChange`.
- Snapshot sync relies on the actor's existing `refreshManualLayout` after a model undo; UT-260
  proves it, and E2E-009 proves it end to end.

## Subtasks

- [ ] 14.1 Server: history with a connection; `modifiedUris` in undo/redo results.
- [ ] 14.2 VSCode extension: messenger requests for undo/redo → LSP `UndoChange` / `RedoChange`,
  save `modifiedUris`.
- [ ] 14.3 VSCode preview: port methods in `state.ts`.
- [ ] 14.4 Diagram: UT-260 in the actor specs (fix the flow if it fails).
- [ ] 14.5 E2E: E2E-009 in the dev-server suite.
- [ ] 14.6 Manual: US-018 AC-1–AC-3 in Code - OSS (see the e2e tooling memory for packing).

## Implementation Details

### Relevant Files

- `packages/language-server/src/model-change/ModelChanges.ts` — `recordHistory`, `restore`,
  `applyWorkspaceEdits`.
- `packages/language-server/src/model-change/undo.spec.ts`, `__test__/memfsWorkspace.ts`.
- `packages/vscode/src/useRpc.ts`, `packages/vscode/src/panel/activateMessenger.ts`.
- `packages/vscode-preview/src/state.ts`, `packages/vscode-preview/src/vscode.ts`.
- `packages/diagram/src/editor/actor/state.sync-queue.ts:300-380`.

## Tests

- [ ] UT-134 — apply/undo/redo over a faked connection
- [ ] IT-009 — undo request over an LSP connection (new expectation)
- [ ] UT-260 — snapshot refresh after a model undo
- [ ] E2E-009 — dev-server: drop, Ctrl+Z, no drift
