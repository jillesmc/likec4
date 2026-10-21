---
provider: manual
pr:
round: 1
round_created_at: 2026-10-21T20:27:26Z
status: valid
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

- Decision: `VALID`
- Notes: Reproduced in Code - OSS (task 06 pass) and with the fake LSP connection: the change is
  applied, then reverted with a second `workspace/applyEdit`, and the failure result carries no URIs,
  so the extension never saves the reverted documents. Fix: `ModelChangeError` carries the reverted
  URIs; the failure branch of `ChangeView.Res` gains `modifiedUris` (additive); `useRpc` maps them and
  `activateMessenger` saves them in the failure path too.
- Fix: `model-change/ModelChangeError.ts`, `ModelChanges.ts`, `protocol.ts`, `vscode/src/useRpc.ts`,
  `vscode/src/panel/activateMessenger.ts`. Regression: `renameElement.spec.ts` "review 001-002" (fake
  LSP: refused rename lists the reverted URI, two workspace edits, file unchanged); it failed before
  the fix. Code - OSS: the refused move of `cloud` under `customer` leaves no unsaved document
  (`evidence/reviews-001/issue_002-refused-move-saved.png`). Gates: language-server 970 passed,
  `pnpm typecheck` 26/26.
