---
status: pending
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

- [ ] 6.1 Diagram: `MovePrompt` in `editor-ui/` (Mantine searchable list in `PromptPortal`).
- [ ] 6.2 Diagram: toolbar button in `ElementToolbar.tsx` / `CompoundToolbar.tsx`.

## Implementation Details

### Relevant Files

- `packages/diagram/src/editor-ui/PromptPortal.tsx`, `deleteFromModel.tsx` (gating).
- `packages/diagram/src/likec4diagram/custom/nodes/toolbar/ElementToolbar.tsx`,
  `CompoundToolbar.tsx`.
- `e2e/tests/visual-to-code.spec.ts`.

## Tests

- [ ] UT-065, UT-066
- [ ] E2E-003
