---
provider: manual
pr:
round: 1
round_created_at: 2026-10-21T20:27:26Z
status: pending
file: packages/language-server/src/model-change/ModelChanges.ts
line: 707
severity: medium
author: claude-code
provider_ref:
---

# Issue 002: In VSCode a reverted change leaves the documents marked unsaved

## Review Comment

When a model change is refused after it was applied (validity guard or resolution guard), `revert()`
restores the texts through `applyWorkspaceEdits`. With an LSP connection that is a second
`workspace/applyEdit`: the editor documents end up with their original content but marked dirty,
because the extension saves `modifiedUris` only on success (`activateMessenger.ts`), and the failure
branch of `ChangeView.Res` carries no URIs.

Observed in the task 06 Code - OSS pass: moving `cloud` under `customer` (refused with
"Invalid parent-child relationship") left `model.c4` with the unsaved marker although its text equals
the file on disk. Phase 2 makes the revert path more frequent (the resolution guard refuses captures
and unsupported moves after applying), and the canvas user never touches those editors, so the
dirty state is unexpected and invites a confusing "Save changes?" prompt.

Suggested fix: return the URIs touched by the revert in the failure branch
(`modifiedUris` on `{ success: false }`, additive), and have the extension save them in the
failure path as it does on success. Cover it with a ModelChanges spec using the fake LSP connection
(the failure result lists the reverted URIs) and a Code - OSS check.

## Triage

- Decision: `UNREVIEWED`
- Notes:
