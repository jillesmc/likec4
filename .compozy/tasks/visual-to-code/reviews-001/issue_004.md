---
provider: manual
pr:
round: 1
round_created_at: 2026-10-13T21:56:39Z
status: valid
file: packages/language-server/src/model-change/ModelChanges.ts
line: 357
severity: medium
author: claude-code
provider_ref:
---

# Issue 004: Server undo stack is shared by all clients of a project

## Review Comment

The undo history is one stack per project on the server, but the canvas history (model entries) is per editor actor (per browser tab). Any other client that changes the same project through `updateView` (a second tab, the AI chat, an agent using the RPC) pushes onto the same stack. A Ctrl+Z in tab A then reverts tab B's latest change (or an agent's change), not the change tab A made, and redo/undo counts no longer match the canvas history.

Suggested fix: return an identifier for the recorded entry in `ChangeView.Res` (e.g. `historyId`) and let the client undo/redo by id. The server refuses with `stale-undo` when the entry is not the top of the stack or the files changed. Alternatively, scope the stack per client connection (the vite RPC channel / HMR client id).

## Triage

- Decision: `VALID`
- Notes: Valid. The server stack is per project, but the canvas history is per tab, so Ctrl+Z can revert another client's change. Fix: every recorded entry gets a `historyId`, returned in `ChangeView.Res` and `updateView`, carried through `LikeC4EditorChangeResult.historyId` into the canvas model entry. Undo/redo send the id, and the server refuses (`stale-undo`) when it is not the top entry. Specs on server and actor.
- Fix: Fixed: each recorded entry has an id, returned as `historyId` in `ChangeView.Res` / `updateView`. The canvas stores it in the model history entry and sends it on undo/redo (`undoModelChange(viewId, historyId)`), and the server refuses with `stale-undo` when it is not the latest entry. Verified by `undo.spec.ts` (issue 004) and `state.sync-queue.spec.ts` (history ids sent in order). Gates: `pnpm typecheck` passed (26 tasks); language-server 919 passed; diagram 200 passed; vite-plugin 40 passed + the pre-existing `detect-ai` failure; dev-server E2E 12 passed (2 runs); static-build E2E 2 passed.
