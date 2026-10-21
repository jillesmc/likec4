---
status: completed
title: 'Task 02: Rename an element from the canvas in both hosts'
type: feature
complexity: medium
---

# Task 02: Rename an element from the canvas in both hosts

## Overview

F2 on the selected node, or the toolbar's "Rename identifier", opens the identifier prompt and
sends `rename-element`. With task 01 this solves the rename half of the Motivating Problem in
`likec4 start` and the VSCode preview.

## Shippable Outcome

- Outcome: select a node, F2, type, Enter → the element is renamed everywhere and keeps its place;
  Ctrl+Z / Ctrl+Shift+Z undo and redo it. When the current view's id changes, the canvas follows.
- Verify in this task: the specs below, E2E-001 and E2E-002, a manual check in Code - OSS.
- Integration verification: E2E-001, E2E-002.

## Requirements

- `_uiux.md` R1 (rename button only), R3, R5 and States; `_user_stories.md` US-001, US-005;
  `_spec.md` rules 4, 10.
- Reuse `PromptPortal`, `TitlePrompt` and the phase-1 identifier validation (`identifier.ts`).
- Buttons absent on read-only surfaces and for elements of other projects (same gate as
  `canDeleteFromModel`).
- `LikeC4EditorCallbacks.handleChange` may resolve with `{ viewId }`; SPA and VSCode ports return
  the result's `viewId`; the diagram navigates to it after sync.

## Subtasks

- [x] 2.1 Diagram: F2 binding (single selected node, not while an input has focus); rename prompt;
      toolbar button in `ElementToolbar.tsx` / `CompoundToolbar.tsx`.
- [x] 2.2 Diagram: navigation to the result's `viewId`.
- [x] 2.3 Hosts: SPA `ViewEditor.tsx` and VSCode preview/extension pass back `viewId`.
- [x] 2.4 E2E fixture: a second `.c4` file and a manual-layout view.

## Implementation Details

### Relevant Files

- `packages/diagram/src/editor-ui/TitlePrompt.tsx`, `identifier.ts`, `deleteFromModel.tsx`,
  `useTitleEditing.tsx`.
- `packages/diagram/src/likec4diagram/custom/nodes/toolbar/ElementToolbar.tsx`,
  `CompoundToolbar.tsx`.
- `packages/diagram/src/editor/actor/hotkey.ts`, `packages/diagram/src/editor/LikeC4EditorCallbacks.tsx`,
  `packages/diagram/src/editor/useEditorActorLogic.ts`.
- `packages/likec4-spa/src/pages/ViewEditor.tsx`; `packages/vscode-preview/src/state.ts`;
  `packages/vscode/src/panel/activateMessenger.ts`.
- `e2e/tests/visual-to-code.spec.ts`, `e2e/helpers/visual-to-code.ts`.

## Tests

- [x] UT-060, UT-061, UT-062, UT-063, UT-064
- [x] E2E-001, E2E-002
- [x] Code - OSS: rename from the preview touching two files, both saved; undo/redo

## Completion Notes (2026-10-20)

- Diagram: `editor-ui/rename.tsx` (`useRenamePrompt`, `RenameButton`, `RenameProvider`,
  `renameTargetOf`, `isRenameHotkey`); the prompt reuses `TitlePrompt` with a new `validate` prop
  and the phase-1 identifier messages (`Invalid identifier`, `Already used by a sibling`). F2 is
  bound in `DiagramXYFlow` (not the editor hotkey actor: it needs the xyflow selection); the button
  is in the element and compound toolbars, absent for imported elements and on read-only surfaces.
- `LikeC4EditorChangeResult.viewId`: `executeChange` reports a renamed view, the sync queue sends
  `navigate.to` to the diagram and does not wait for the old view. `rename-element` is a model change
  (canvas undo/redo). SPA forwards the RPC result; VSCode preview protocol, extension and `useRpc`
  pass `viewId`.
- Bug found by E2E-001 and fixed: in `likec4 start` the file watcher rebuilt `model.c4` while the
  change rebuilt both files, so `views2.c4` was linked against a stale index and the rename was
  reverted (`Could not resolve reference ... 'platform'`). Model changes now write and rebuild inside
  `FileSystemWatcher.exclusive` (the chokidar queue), and the watcher skips a file whose document is
  already up to date. E2E-001 failed before, passes after.
- VSCode finding (not changed here): clicking a node in the preview reveals its source and moves
  the focus to the `.c4` editor (existing `locate`, `preserveFocus: false`), so F2 right after a
  click goes to the text editor (text rename is task 07). The toolbar button works; F2 works when
  the canvas keeps the focus (browser). Owner decision (2026-10-20): keep it; F2 in the editor
  renames the same element once task 07 is done (`_spec.md` Q8).
- E2E: fixture `rename.c4` (a view referencing `customer` from another file); E2E-001 (F2, taken name
  refused, both files, snapshot, position kept, no drift), E2E-002 (toolbar, Ctrl+Z / Ctrl+Shift+Z
  with the layout). E2E-002 waits for the editor's 500 ms sync window after an undo before redoing.
- Verification: diagram 236 passed; language-server 950 passed; `pnpm typecheck` 26/26; dev-server
  E2E 24 passed; static-build E2E 2 passed. Code - OSS (preview, toolbar rename touching
  `model.c4` + `views2.c4`): 7/7 checks pass, both documents saved, undo/redo; screenshots in
  `evidence/task_02/`.
