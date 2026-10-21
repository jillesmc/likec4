---
status: completed
title: 'Task 03: Rename deployment nodes and instances'
type: feature
complexity: medium
---

# Task 03: Rename deployment nodes and instances

## Overview

Extend the planner and the canvas rename to deployment nodes and deployed instances.

## Shippable Outcome

- Outcome: `rename-element` with `target: { deployment }` renames a deployment node or an
  instance and rewrites every reference; renaming an unnamed instance inserts its name. In
  deployment views, F2 and the toolbar's "Rename identifier" work on deployment nodes and
  instances.
- Verify in this task: the specs below, plus a manual check in `likec4 start`.
- Integration verification: none (task 08 covers the hosts).

## Requirements

- `_spec.md` rules 2–4; `_user_stories.md` US-002; `_uiux.md` R2; `_dx.md` Ops.
- Deployment `StrictFqnRef` and `FqnRef` chains, `extend` of deployment nodes, deployment view
  rules, deployment relations.

## Subtasks

- [x] 3.1 Server: deployment branch of `planRename` and of the `renameElement.ts` preconditions.
- [x] 3.2 Diagram: rename button and F2 on deployment node / instance nodes.

## Implementation Details

### Relevant Files

- `packages/language-server/src/model-change/_references.ts`, `renameElement.ts`.
- `packages/language-server/src/model/deployments-index.ts` (deployment FQNs).
- `packages/language-server/src/like-c4.langium:821-890` — deployment grammar.
- `packages/diagram/src/likec4diagram/custom/nodes/toolbar/ElementToolbar.tsx` (deployment branch).

## Tests

- [x] UT-012 — renaming an unnamed instance inserts `name = `
- [x] UT-016, UT-017 — deployment node rename; deployment `name-collision`

## Completion Notes (2026-10-20)

- Core: `RenameElement.target` is `{ element } | { deployment }`.
- Server: `_references.ts` shares the reference renamer between elements and deployment items;
  `planDeploymentRename` renames a deployment node or a named instance, and inserts `name = ` before
  `instanceOf` for an unnamed one (its name node is the element reference, which must not change).
  `renameElement.ts` checks the collision on the deployment FQN; renames go to the deployment map
  (guard and snapshots of deployment views).
- Diagram: `renameTargetOf` returns the deployment item for `deployment` / `compound-deployment`
  nodes; the prompt checks the names of the deployment siblings; the rename button is in the
  deployment and compound-deployment toolbars.
- Verification: language-server rename spec 24 passed (UT-012, UT-016 node + named instance,
  UT-017); diagram 236 passed; core and package typechecks clean. Manual check in `likec4 start`
  (deployment view `prod`): F2 on `prod`, `production` written to the definition and to
  `include production, production.**`, the node shown with the new id.
