---
status: pending
title: 'Task 05: Move engine: cut and paste with reference rewrite'
type: backend
complexity: high
---

# Task 05: Move engine: cut and paste with reference rewrite

## Overview

The server side of `move-element`: move an element's statement (with its subtree and the comments
above it) into another parent's block or to the top level, and rewrite the references. Consumer:
task 06.

## Shippable Outcome

- Outcome: `{ op: 'move-element', element, parent }` through `likec4/change-view` / `updateView`
  moves the statement, rewrites references (full FQNs), appends an `include` when the element
  would be hidden, runs the guard, rewrites snapshots and records one history entry.
- Verify in this task: the specs below.
- Integration verification: IT-004.

## Requirements

- `_spec.md` rules 5–9, 11, 13 (imported root elements refused); `_dx.md` Ops and Errors
  (`invalid-parent`, `name-collision`, `has-references`); `_user_stories.md` US-003, US-004 AC-3.
- Placement and indentation reuse the phase-1 `_anchors.ts` / `addElement.ts` logic (D4).
- Visibility prediction reuses the phase-1 machinery in `ModelChanges`.

## Subtasks

- [ ] 5.1 Server: `planMove` in `_references.ts` (statement range with comments, insertion,
      re-indent, reference rewrite inside and outside the block).
- [ ] 5.2 Server: `moveElement.ts` with preconditions and visibility include.

## Implementation Details

### Relevant Files

- `packages/language-server/src/model-change/_anchors.ts`, `addElement.ts`, `_visibility.ts`.
- `packages/language-server/src/model-change/_references.ts`, `_guard.ts`, `ModelChanges.ts`.
- `packages/core/src/manual-layout/` (`renameFqnsInSnapshot`, from task 01).

## Tests

- [ ] UT-020 – UT-029 — placement, comments, body, other file, top level, references, include,
      collision, invalid parent
- [ ] UT-031 — moving an imported root element → `has-references`
- [ ] IT-004 — move across files through `applyChange`
