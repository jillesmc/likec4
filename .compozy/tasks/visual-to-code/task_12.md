---
status: completed
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

- [x] 12.1 Core: `beforeStep?` on `AddDynamicStep`; `ViewChange.RemoveDynamicStep`.
- [x] 12.2 Server: `beforeStep` in `addDynamicStep.ts` (`insertBeforeNode`);
  `removeDynamicStep.ts` (step path → AST via `locateDynamicViewStep` or the compute numbering,
  `removeNode`).
- [x] 12.3 Diagram: position select in the connect popover; `Del` handling for step edges in
  `exclude.ts` / `onBeforeDelete`.
- [x] 12.4 E2E: E2E-008 on the `flow` view of `e2e/fixtures/visual-to-code/dynamic.c4`.

## Implementation Details

### Relevant Files

- `packages/language-server/src/like-c4.langium:655-810` — `StepStatement`, blocks, `StepSeries`.
- `packages/core/src/types/scalar.ts:147-201` — `StepPath`.
- `packages/core/src/compute-view/dynamic-view/` — step path numbering.
- `packages/language-server/src/model/model-locator.ts` — `locateDynamicViewStep`.
- `packages/language-server/src/model-change/addDynamicStep.ts`, `_anchors.ts`.
- `packages/diagram/src/editor-ui/exclude.ts`, `connect.ts`.

## Tests

- [x] UT-230, UT-231 — insert before / out of range
- [x] UT-232, UT-233 — position field
- [x] UT-240, UT-241, UT-242 — removal at top level and in blocks
- [x] UT-243, UT-244 — chain refused, unknown path
- [x] UT-245 — `Del` on step edge vs node
- [x] E2E-008 — step removed from `dynamic.c4`

## Completion Notes (2026-10-18)

- Contract change (spec, DX, stories and tests updated): `beforeStep` is the id of a step
  (`StepPath`), not an index. A chain `a -> b -> c` is one statement with several steps, so a
  statement index would not match the step numbers the user sees. The server inserts before the
  top-level statement that contains the step; unknown ids append at the end.
- Server: `_steps.ts` finds a step by id in the view computed from the current sources (its
  `astPath`), shared by `addDynamicStep.ts` (`beforeStep`) and the new `removeDynamicStep.ts`
  (single steps at any depth, chain steps refused with `unsupported-in-view`, empty blocks kept).
- Diagram:
  - `ConnectPrompt` handles both modes: relation (title, kind, technology) and step (title,
    position). `steps.ts`: `stepPositions` (one entry per top-level step, blocks count as one) and
    `removeStepChangesOf` (removed last first, so the ids of the next ones stay valid).
  - `Del` on step edges in dynamic views sends `remove-dynamic-step`; nodes are still not deletable
    there. Root cause found with the E2E: dynamic view edges were created with `deletable: false`
    (`xyflow-diagram/diagram-view.ts`), so xyflow dropped them before `onBeforeDelete`; edges are now
    deletable in every view.
  - `remove-dynamic-step` is a model change (canvas undo) and refreshes a manual layout, like
    `exclude-from-view`.
- E2E: US-009 confirms the prompt; new `US-015 + E2E-008` scenario (insert before step 1, remove a
  step with `Del`), waiting for the relayout between gestures.
- Verification: language-server 930 passed; diagram 221 passed; `pnpm typecheck` 26/26; dev-server
  E2E 17 passed (twice); static-build E2E 2 passed.

