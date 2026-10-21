---
status: pending
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

- [ ] 3.1 Server: deployment branch of `planRename` and of the `renameElement.ts` preconditions.
- [ ] 3.2 Diagram: rename button and F2 on deployment node / instance nodes.

## Implementation Details

### Relevant Files

- `packages/language-server/src/model-change/_references.ts`, `renameElement.ts`.
- `packages/language-server/src/model/deployments-index.ts` (deployment FQNs).
- `packages/language-server/src/like-c4.langium:821-890` — deployment grammar.
- `packages/diagram/src/likec4diagram/custom/nodes/toolbar/ElementToolbar.tsx` (deployment branch).

## Tests

- [ ] UT-012 — renaming an unnamed instance inserts `name = `
- [ ] UT-016, UT-017 — deployment node rename; deployment `name-collision`
