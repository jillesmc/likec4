---
provider: manual
pr:
round: 1
round_created_at: 2026-10-13T21:56:39Z
status: pending
file: packages/language-server/src/model-change/ModelChanges.ts
line: 449
severity: high
author: claude-code
provider_ref:
---

# Issue 001: revert() swallows write failures; undo and guard report success

## Review Comment

`LikeC4ModelChanges.revert()` only logs when `applyWorkspaceEdits` returns `applied: false`. Its two callers trust it:

- `restore()` (undo/redo, line ~435) calls `revert(texts)`, then pushes the entry to the other stack and returns `{ success: true }`. If writing the file fails (permission, file removed, LSP edit refused), the canvas believes the undo happened while the sources are unchanged, and the history stacks are now out of sync with the files.
- `applyPlan()` (guard, line ~340) calls `revert(before)` and then throws `invalid-result` with "Change reverted: ...", even when the revert did not happen. The user is told the file is back to its original state, but the invalid edit is still in the sources.

This breaks Safety Invariant 1 ("a rejected gesture leaves every `.c4` file byte-identical").

Suggested fix: make `revert()` return the `ApplyEditsResult` (or throw). In `restore()`, put the entry back on its original stack and return `{ success: false, code: 'apply-failed', error }` when the revert fails. In `applyPlan()`, report `apply-failed` with a message saying the invalid change could not be reverted, instead of claiming it was reverted. Add a spec that mocks `FileSystemProvider.writeFile` to fail during undo and during the guard revert.

## Triage

- Decision: `UNREVIEWED`
- Notes:
