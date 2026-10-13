---
status: pending
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

- [ ] 7.1 Core: `ViewChange.AddDeploymentNode`, `ViewChange.AddInstance`.
- [ ] 7.2 Server: `addDeploymentNode.ts`, `addInstance.ts`.
- [ ] 7.3 UI: deployment palette items and the instance element-search popover.

## Implementation Details

### Relevant Files

- `packages/language-server/src/like-c4.langium:827-870` — `DeploymentNode`, `DeployedInstance`.
- `packages/language-server/src/model/model-locator.ts:130-148` — `locateDeploymentElement`.

## Tests

- [ ] UT-140, UT-141, UT-142 — deployment node
- [ ] UT-143, UT-144, UT-145 — instance
