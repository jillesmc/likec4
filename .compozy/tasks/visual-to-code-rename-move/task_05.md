---
status: completed
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

- [x] 5.1 Server: `planMove` in `_references.ts` (statement range with comments, insertion,
      re-indent, reference rewrite inside and outside the block).
- [x] 5.2 Server: `moveElement.ts` with preconditions and visibility include.

## Implementation Details

### Relevant Files

- `packages/language-server/src/model-change/_anchors.ts`, `addElement.ts`, `_visibility.ts`.
- `packages/language-server/src/model-change/_references.ts`, `_guard.ts`, `ModelChanges.ts`.
- `packages/core/src/manual-layout/` (`renameFqnsInSnapshot`, from task 01).

## Tests

- [x] UT-020 – UT-029 — placement, comments, body, other file, top level, references, include,
      collision, invalid parent
- [x] UT-031 — moving an imported root element → `has-references`
- [x] IT-004 — move across files through `applyChange`

## Completion Notes (2026-10-21)

- Core: `ViewChange.MoveElement`.
- Server: `moveElement.ts` holds the move planner (not `_references.ts`: it shares no code with the
  rename planner beyond `findReferences`). The statement is cut with the comment lines right above
  it, the inner reference edits are applied to the moved text, which is re-indented and appended to
  the new parent's block (`appendToBlock` / `appendBody`) or to the first `model {}` of the view's
  file. Outside references to the moved subtree are rewritten as whole chains (`a.b.c`) to the new
  full FQN, once per chain (for the item it points to); inside, qualified references to the subtree
  and references to other elements get full FQNs. A top-level element imported by another project is
  refused (`has-references`).
- Visibility (rule 7): `include <newFqn>` only when the element was shown before and would not be
  after (`isMovedElementVisible` patches elements and relation ends; parents sorted before children).
- Guard (ADR-001 refined): whole references only, keys without documents, and a change may add
  references. Found by UT-023 and IT-004: the inner segments rewritten by a move and the added
  `include` were reported as broken.
- `_anchors` insertion keeps blank lines blank (no trailing indentation in moved blocks).
- Verification: move spec 10 passed (UT-020 – UT-029, UT-031, IT-004); the UT-027 case "not visible
  before" failed before the rule-7 fix; language-server 965 passed; `pnpm typecheck` 26/26.
