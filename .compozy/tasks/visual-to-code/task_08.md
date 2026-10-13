---
status: completed
title: "Task 8: Dynamic views: add step on connect"
type: feature
complexity: medium
---

# Task 8: Dynamic views: add step on connect

## Overview

Connecting A → B in a dynamic view appends a step `A -> B` to the view instead of creating a
model relation.

## Shippable Outcome

- Outcome: in dynamic views, `onConnect` emits `add-dynamic-step`. The step is appended after the
  last top-level step (Q3 default). Sending the op against a non-dynamic view returns
  `unsupported-in-view`.
- Verify in this task: the specs below, plus a manual check in `likec4 start`.
- Integration verification: none.

## Requirements

- `_user_stories.md` US-009; `_spec.md` Business Rule 11 (the guard reverts invalid steps).
- The step goes at top level, never inside `parallel` / alt blocks.
- Non-element nodes are not connectable in dynamic views.

## Subtasks

- [x] 8.1 Core: `ViewChange.AddDynamicStep`.
- [x] 8.2 Server: `addDynamicStep.ts` plus the view-type precondition.
- [x] 8.3 Diagram: branch `onConnect` by view type.

## Implementation Details

### Relevant Files

- `packages/language-server/src/like-c4.langium:332-362,655-665` — dynamic view body, step
  statements.
- `packages/language-server/src/model/model-locator.ts:316-330` — `locateDynamicViewStep`.

## Tests

- [x] UT-045 — `unsupported-in-view`
- [x] UT-150, UT-151, UT-152 — step placement

## Completion Notes (2026-10-13)

- Server (`addDynamicStep.ts`): writes `source -> target` after the last top-level step (after
  `parallel`/alt blocks, never inside them), before the first rule when there are no steps, or
  at the end of the body. No model relation is created. Non-dynamic views are rejected
  (`unsupported-in-view`). New anchor helpers: `insertAfterNode`, `insertBeforeNode`.
- Diagram: `resolveConnection(from, to, viewType)` emits `add-dynamic-step` in dynamic views. The
  `editorAffordances` connect gate covers element and dynamic views, and the sequence variant is
  excluded (its nodes are not elements). Ghost edges, the error toast and canvas undo/redo cover
  steps too.
- E2E fixture gained `dynamic.c4` (`customer.app` / `customer.web` via `extend customer`, dynamic
  view `flow`). New scenario `US-009: connecting two elements in a dynamic view appends a step`,
  using `?dynamic=diagram`.
- Verification: language-server 909 passed; diagram 198 passed; `pnpm typecheck` passed (26 tasks);
  dev-server E2E 9 passed (2 runs); static-build E2E 2 passed.
