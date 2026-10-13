---
status: completed
title: "Task 7: Deployment views: add deployment node and instance"
type: feature
complexity: medium
---

# Task 7: Deployment views: add deployment node and instance

## Overview

In deployment views the palette lists deployment-node kinds and an "Instance" item. Dropping
creates a nested deployment node, or an `instanceOf` chosen from an element search.

## Shippable Outcome

- Outcome: `add-deployment-node` and `add-instance` work end-to-end (US-007, US-008), reusing the
  palette, popover, ghost and D12 placement from task 03.
- Verify in this task: the handler specs below, plus a manual check in `likec4 start` on a
  deployment view.
- Integration verification: none.

## Requirements

- `_spec.md` Business Rules 3, 5, 6; `_uiux.md` S3/S4 (deployment states).
- An instance drop on empty canvas is not accepted (US-008 EC-1).
- A duplicate instance in the same node is named `<name>2 = instanceOf …`.
- Retitle and exclude in deployment views are already covered by tasks 04/05 (deployment
  title, instance title and deployment exclude cases).

## Subtasks

- [x] 7.1 Core: `ViewChange.AddDeploymentNode`, `ViewChange.AddInstance`.
- [x] 7.2 Server: `addDeploymentNode.ts`, `addInstance.ts`.
- [x] 7.3 UI: deployment palette items and the instance element-search popover.

## Implementation Details

### Relevant Files

- `packages/language-server/src/like-c4.langium:827-870` — `DeploymentNode`, `DeployedInstance`.
- `packages/language-server/src/model/model-locator.ts:130-148` — `locateDeploymentElement`.

## Tests

- [x] UT-140, UT-141, UT-142 — deployment node
- [x] UT-143, UT-144, UT-145 — instance

## Completion Notes (2026-10-13)

- Server (`addDeployment.ts`):
  - `add-deployment-node` writes `name = kind 'title'` into the parent node, or into the first
    `deployment {}` of the view file (created when missing). It rejects unknown kinds and
    non-deployment views, and derives the name from the title.
  - `add-instance` writes `instanceOf <element>` named after the element. When that name is
    taken it writes `name2 = instanceOf <element>`. A missing element is rejected (`not-found`).
  - Both add `include <fqn>` only when the new item would be hidden
    (`isDeploymentElementVisible`).
- UI: `useElementDrop` became `useCanvasDrop`, which handles element and deployment views.
  - The palette (`canvasPalette`) lists the deployment node kinds plus "Instance" in deployment
    views.
  - An "Instance" drop needs a deployment node (not an instance) under the pointer, otherwise it
    is ignored (US-008 EC-1, no indicator). It asks for the element in `TitlePrompt` with
    `options` (input + datalist of model element FQNs; only listed values are accepted).
  - Ghosts and D12 placement now cover deployment nodes and instances.
- E2E fixture gained `deployment.c4` (env/vm kinds, `prod`, deployment view `prod`). The helper
  now restores every fixture file. New scenario
  `US-007 + US-008: deployment view palette creates nodes and instances`.
- Verification: language-server 905 passed; diagram 196 passed; `pnpm typecheck` passed (26 tasks);
  dev-server E2E 8 passed.
