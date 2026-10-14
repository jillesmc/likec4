---
provider: manual
pr:
round: 1
round_created_at: 2026-10-13T21:56:39Z
status: valid
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

- Decision: `VALID`
- Notes: Valid. Only the last placement is applied, to the first new node. Fix: the server returns the created FQN (`ChangeView.Res.created`), the canvas keeps it with the ghost, and every settled placement is applied to its own node by id (falls back to the previous behaviour when the id is unknown). Specs for `placeNewNodes` and the server result.
- Fix: Fixed: `ChangeView.Res.created` returns the created fqn, the canvas stores it on the ghost, and `placeNewNodes` places every created node at its own drop position. Verified by `applyChangesToManualLayout.spec.ts` and `addElement.spec.ts` (issue 013). Gates: `pnpm typecheck` passed (26 tasks); language-server 919 passed; diagram 200 passed; vite-plugin 40 passed + the pre-existing `detect-ai` failure; dev-server E2E 12 passed (2 runs); static-build E2E 2 passed.
