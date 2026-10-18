---
status: pending
title: "Task 12: Dynamic views: step position and step removal"
type: feature
complexity: high
---

# Task 12: Dynamic views: step position and step removal

## Overview

In dynamic views, a new step can be inserted before a chosen top-level step, and `Del` on a step
edge removes that step. Owner decisions Q3 and Q5, 2026-10-18.

## Shippable Outcome

- Outcome: `AddDynamicStep.beforeStep?` inserts before the statement at that index (end when
  omitted or out of range). New op `remove-dynamic-step { step: StepPath }` removes a single step
  statement at any depth, and refuses steps of a chain. The connect popover in dynamic views has
  title + position; `Del` on a step edge emits the removal.
- Verify in this task: the specs below, plus E2E-008.
- Integration verification: none.

## Requirements

- `_spec.md` Business Rules 8 and 17, Core Interfaces amendment; `_uiux.md` S8 and S10 (dynamic);
  `_dx.md` `placed` / `unstep` snippets; `_user_stories.md` US-015, US-016.
- Step paths must match the ids the diagram uses (`step-02:par.01`); resolve them with the same
  numbering as the core dynamic-view compute, not a parallel one.
- A chain step (`StepSeries`) → `unsupported-in-view` with `Steps of a chain cannot be removed
  from the canvas`. A block left empty stays.
- `Del` on nodes in dynamic views keeps doing nothing (UT-063 stays green).
- Uses the shared connect popover from task 10.

## Subtasks

- [ ] 12.1 Core: `beforeStep?` on `AddDynamicStep`; `ViewChange.RemoveDynamicStep`.
- [ ] 12.2 Server: `beforeStep` in `addDynamicStep.ts` (`insertBeforeNode`);
  `removeDynamicStep.ts` (step path → AST via `locateDynamicViewStep` or the compute numbering,
  `removeNode`).
- [ ] 12.3 Diagram: position select in the connect popover; `Del` handling for step edges in
  `exclude.ts` / `onBeforeDelete`.
- [ ] 12.4 E2E: E2E-008 on the `flow` view of `e2e/fixtures/visual-to-code/dynamic.c4`.

## Implementation Details

### Relevant Files

- `packages/language-server/src/like-c4.langium:655-810` — `StepStatement`, blocks, `StepSeries`.
- `packages/core/src/types/scalar.ts:147-201` — `StepPath`.
- `packages/core/src/compute-view/dynamic-view/` — step path numbering.
- `packages/language-server/src/model/model-locator.ts` — `locateDynamicViewStep`.
- `packages/language-server/src/model-change/addDynamicStep.ts`, `_anchors.ts`.
- `packages/diagram/src/editor-ui/exclude.ts`, `connect.ts`.

## Tests

- [ ] UT-230, UT-231 — insert before / out of range
- [ ] UT-232, UT-233 — position field
- [ ] UT-240, UT-241, UT-242 — removal at top level and in blocks
- [ ] UT-243, UT-244 — chain refused, unknown path
- [ ] UT-245 — `Del` on step edge vs node
- [ ] E2E-008 — step removed from `dynamic.c4`
