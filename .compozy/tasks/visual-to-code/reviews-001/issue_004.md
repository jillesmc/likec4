---
provider: manual
pr:
round: 1
round_created_at: 2026-10-13T21:56:39Z
status: pending
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

- Decision: `UNREVIEWED`
- Notes:
