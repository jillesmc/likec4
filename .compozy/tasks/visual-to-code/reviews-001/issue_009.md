---
provider: manual
pr:
round: 1
round_created_at: 2026-10-13T21:56:39Z
status: valid
file: packages/diagram/src/editor-ui/useCanvasDrop.tsx
line: 79
severity: medium
author: claude-code
provider_ref:
---

# Issue 009: Instance drop outside a deployment node fails silently (US-008 EC-1)

## Review Comment

Dropping the "Instance" palette item on empty canvas (or on an instance) is ignored without any feedback. US-008 EC-1 requires that the drop is not accepted *and* that the user sees "drop on a deployment node". Today nothing happens, which is indistinguishable from a broken drag-and-drop.

Suggested fix: when `dragged === INSTANCE_ITEM` and there is no deployment node under the pointer, surface a message. The cheapest way is to reuse the editor error notification (send an event that sets `lastError`, e.g. `Drop "Instance" on a deployment node`). Alternatively, use `onDragOver` to set `dropEffect = 'none'` and show a hint while hovering empty canvas.

## Triage

- Decision: `VALID`
- Notes: Valid. An instance drop outside a deployment node is silently ignored. Fix: show `Drop "Instance" on a deployment node` through the editor error notification (new `error.show` event on the editor actor).
- Fix: Fixed: `useCanvasDrop` calls `onInvalidDrop`, and `DiagramXYFlow` sends the new `error.show` event to the editor actor. Verified by `state.sync-queue.spec.ts` (issue 009) and E2E 'review 009'. Gates: `pnpm typecheck` passed (26 tasks); language-server 919 passed; diagram 200 passed; vite-plugin 40 passed + the pre-existing `detect-ai` failure; dev-server E2E 12 passed (2 runs); static-build E2E 2 passed.
