---
provider: manual
pr:
round: 1
round_created_at: 2026-10-13T21:56:39Z
status: pending
file: packages/diagram/src/editor/actor/actions.ts
line: 285
severity: low
author: claude-code
provider_ref:
---

# Issue 013: Only the last drop position applies when several items settle together

## Review Comment

`settleGhosts` takes only the last settled ghost with a position (`findLast`) and `placeNewNode` moves the first new leaf node it finds. When two elements are dropped quickly enough to be executed in the same batch, one element is placed at the other's drop position, and the other is left at the auto-layout position.

Suggested fix: pass all settled placements (`{ fqn?, position }`) to `applyLatest`, and match new nodes by FQN (the server already knows the created FQN and could return it in `ChangeView.Res`). Or apply the first placement to the first new node, in order.

## Triage

- Decision: `UNREVIEWED`
- Notes:
