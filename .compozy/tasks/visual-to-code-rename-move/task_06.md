---
status: completed
title: "Task 06: Move an element from the canvas with \"Move to…\""
type: feature
complexity: medium
---

# Task 06: Move an element from the canvas with "Move to…"

## Overview

The toolbar's "Move to…" opens a searchable list of parents and sends `move-element`. Completes
the move half of the Motivating Problem.

## Shippable Outcome

- Outcome: toolbar "Move to…" on an element → list with "Top level" first and the possible
  parents, filtered by typing → Enter moves the element; undo/redo work as for renames.
- Verify in this task: the specs below, E2E-003, a manual check in Code - OSS.
- Integration verification: E2E-003.

## Requirements

- `_uiux.md` R1 ("Move to…"), R4 and States; `_user_stories.md` US-003 AC-1, EC-4; `_spec.md`
  rule 5.
- The list excludes the element, its descendants and its current parent; only elements of the
  current project. Absent on deployment nodes, instances and read-only surfaces.

## Subtasks

- [x] 6.1 Diagram: `MovePrompt` in `editor-ui/` (Mantine searchable list in `PromptPortal`).
- [x] 6.2 Diagram: toolbar button in `ElementToolbar.tsx` / `CompoundToolbar.tsx`.

## Implementation Details

### Relevant Files

- `packages/diagram/src/editor-ui/PromptPortal.tsx`, `deleteFromModel.tsx` (gating).
- `packages/diagram/src/likec4diagram/custom/nodes/toolbar/ElementToolbar.tsx`,
  `CompoundToolbar.tsx`.
- `e2e/tests/visual-to-code.spec.ts`.

## Tests

- [x] UT-065, UT-066
- [x] E2E-003

## Completion Notes (2026-10-21)

- Diagram: `editor-ui/move.tsx` (`useMovePrompt`, `MoveButton`, `MoveProvider`, `moveParents`,
  `moveTargetOf`, `TOP_LEVEL`). The prompt is `TitlePrompt` with `options` (the phase-1 "Element to
  deploy" pattern: a datalist suggests FQNs while typing and only a listed value is accepted), not a
  custom searchable list; `_uiux.md` R4 updated. The button sits next to "Rename identifier" in the
  element and compound toolbars; absent on deployment items, imported elements, read-only surfaces
  and without the model. `move-element` is a model change (canvas undo/redo).
- E2E-003 (dev server): toolbar "Move to…" on `cloud`, a partial name is refused, `customer` moves
  the statement under `customer` and adds `include customer.cloud` (it was shown by `include *`).
- Code - OSS (preview, `cloud` moved into `billing`): 7/7 checks pass — list opens, statement moved,
  `-> billing.cloud` rewritten, `views2.c4` rewritten, node shown as `billing.cloud`, both documents
  saved, Ctrl+Z restores both files. Screenshots in `evidence/task_06/`.
- Observed (not changed): moving `cloud` under `customer` while `customer -> cloud` exists is
  refused by the validity guard (`Invalid parent-child relationship`), as it should; in VSCode the
  reverted document stays marked unsaved (content identical) — the same phase-1 revert path.
- Verification: diagram 239 passed; `pnpm typecheck` 26/26; dev-server E2E 25 passed; static-build
  E2E 2 passed.
