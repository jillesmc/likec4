---
status: completed
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

- [x] 14.1 Server: history with a connection; `modifiedUris` in undo/redo results.
- [x] 14.2 VSCode extension: messenger requests for undo/redo → LSP `UndoChange` / `RedoChange`,
  save `modifiedUris`.
- [x] 14.3 VSCode preview: port methods in `state.ts`.
- [x] 14.4 Diagram: UT-260 in the actor specs (fix the flow if it fails).
- [x] 14.5 E2E: E2E-009 in the dev-server suite.
- [x] 14.6 Manual: US-018 AC-1–AC-3 in Code - OSS (see the e2e tooling memory for packing).

## Implementation Details

### Relevant Files

- `packages/language-server/src/model-change/ModelChanges.ts` — `recordHistory`, `restore`,
  `applyWorkspaceEdits`.
- `packages/language-server/src/model-change/undo.spec.ts`, `__test__/memfsWorkspace.ts`.
- `packages/vscode/src/useRpc.ts`, `packages/vscode/src/panel/activateMessenger.ts`.
- `packages/vscode-preview/src/state.ts`, `packages/vscode-preview/src/vscode.ts`.
- `packages/diagram/src/editor/actor/state.sync-queue.ts:300-380`.

## Tests

- [x] UT-134 — apply/undo/redo over a faked connection
- [x] IT-009 — undo request over an LSP connection (new expectation)
- [x] UT-260 — snapshot refresh after a model undo
- [x] E2E-009 — dev-server: drop, Ctrl+Z, no drift

## Completion Notes (2026-10-18)

- Server: the history is recorded with and without an LSP client. Texts after a change are computed
  from its edits (with a client, documents are updated asynchronously). Undo/redo restore through
  `applyWorkspaceEdits` (one `WorkspaceEdit` with a client) and return `modifiedUris`.
- VSCode: new messenger request `webview:model-history` → LSP `likec4/undo-change` /
  `likec4/redo-change`; the extension saves the restored documents. The preview port implements
  `undoModelChange` / `redoModelChange`. The change response now forwards `historyId` and `created`
  (both were dropped before, so the D12 placement in VSCode also benefits).
- Found during the VSCode check and fixed in the same delivery:
  - Relations and steps added in a manual layout view did not refresh the snapshot, which reported
    `edges-added` drift (US-001 EC-11). `settleGhosts` now refreshes for them too.
  - Owner feedback: the connect dot was hard to grab. It is replaced by a 28 px connect button in
    the row of the node action buttons; releasing anywhere over a node connects to it (`_uiux.md`
    S1).
- Verification:
  - language-server 920 passed; diagram 202 passed; `pnpm typecheck` 26/26.
  - UT-260 and the US-001 EC-11 actor test fail when their fix is removed.
  - Dev-server E2E 13 passed (E2E-001 now releases on the target's corner, new US-001 EC-11
    scenario); static-build E2E 2 passed.
  - Real Code - OSS (Extension Development Host under Xvfb, driven over CDP): connect, canvas
    Ctrl+Z / Ctrl+Shift+Z (files saved), manual layout drop + undo (model and snapshot, no drift),
    connect in manual layout (no drift), hand edit + canvas undo (`stale-undo` toast, file
    untouched). Screenshots in `evidence/task_14/`.

