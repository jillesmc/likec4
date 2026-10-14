---
provider: manual
pr:
round: 1
round_created_at: 2026-10-13T21:56:39Z
status: valid
file: packages/diagram/src/editor/actor/state.sync-queue.ts
line: 357
severity: medium
author: claude-code
provider_ref:
---

# Issue 005: Model undo/redo does not refresh the manual layout snapshot

## Review Comment

When an element is added (D12) or items are excluded in a view with manual layout, the editor updates the layout snapshot after sync (`settleGhosts` → `latest-to-manual`). Undoing or redoing that change through `modelHistory` only restores the `.c4` file: `modelHistory.onDone` goes to `waitViewSynced` → `decideNext`, where `settleGhosts` sees no ghosts and `refreshManualLayout === false`, so the snapshot is not refreshed. After Ctrl+Z on an `add-element` in a manual-layout view, the snapshot still contains the removed element and the view shows a drift warning. After undoing an exclude, the re-included item has no position in the snapshot. E2E-004 only covers a view without manual layout.

Suggested fix: set `refreshManualLayout: true` in `modelHistory.onDone`, so `settleGhosts` runs `latest-to-manual` when the view has a manual layout. Add an actor spec, and extend E2E-004 with a manual-layout variant (as done for US-004 AC-4).

## Triage

- Decision: `VALID`
- Notes: Valid. `modelHistory.onDone` does not set `refreshManualLayout`, so undo/redo in a manual-layout view leaves a stale snapshot. Fix: set the flag on done, so `settleGhosts` runs `latest-to-manual` in manual views. Actor spec.
- Fix: Fixed: `modelHistory.onDone` sets `refreshManualLayout`, so the manual layout is refreshed after undo/redo. Verified by E2E 'review 005: undo of an element dropped in a manual layout view leaves no drift'. Gates: `pnpm typecheck` passed (26 tasks); language-server 919 passed; diagram 200 passed; vite-plugin 40 passed + the pre-existing `detect-ai` failure; dev-server E2E 12 passed (2 runs); static-build E2E 2 passed.
