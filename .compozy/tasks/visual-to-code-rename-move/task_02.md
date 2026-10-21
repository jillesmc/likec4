---
status: pending
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

- [ ] 2.1 Diagram: F2 binding (single selected node, not while an input has focus); rename prompt;
      toolbar button in `ElementToolbar.tsx` / `CompoundToolbar.tsx`.
- [ ] 2.2 Diagram: navigation to the result's `viewId`.
- [ ] 2.3 Hosts: SPA `ViewEditor.tsx` and VSCode preview/extension pass back `viewId`.
- [ ] 2.4 E2E fixture: a second `.c4` file and a manual-layout view.

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

- [ ] UT-060, UT-061, UT-062, UT-063, UT-064
- [ ] E2E-001, E2E-002
- [ ] Code - OSS: rename from the preview touching two files, both saved; undo/redo
