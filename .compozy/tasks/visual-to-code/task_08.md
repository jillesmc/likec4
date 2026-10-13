---
status: pending
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

- [ ] 8.1 Core: `ViewChange.AddDynamicStep`.
- [ ] 8.2 Server: `addDynamicStep.ts` plus the view-type precondition.
- [ ] 8.3 Diagram: branch `onConnect` by view type.

## Implementation Details

### Relevant Files

- `packages/language-server/src/like-c4.langium:332-362,655-665` — dynamic view body, step
  statements.
- `packages/language-server/src/model/model-locator.ts:316-330` — `locateDynamicViewStep`.

## Tests

- [ ] UT-045 — `unsupported-in-view`
- [ ] UT-150, UT-151, UT-152 — step placement
