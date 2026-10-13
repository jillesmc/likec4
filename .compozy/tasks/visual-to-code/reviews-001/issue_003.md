---
provider: manual
pr:
round: 1
round_created_at: 2026-10-13T21:56:39Z
status: pending
file: packages/language-server/src/model-change/ModelChanges.ts
line: 174
severity: medium
author: claude-code
provider_ref:
---

# Issue 003: View-only edits break the dev-server undo history

## Review Comment

Only model changes (`applyPlan`) are recorded in the undo history. The view changes that already existed before this work (`change-element-style`, `change-autolayout`, `change-property`, applied through `applyTextEdits`) also rewrite the same `.c4` files, but are not recorded. After any of them, undoing an earlier model change finds `current !== file.after`, returns `stale-undo` and clears the whole history (`history.undo = []`). In the browser this shows as an error toast, and all model entries disappear from the canvas history, even though the user only changed a color.

Suggested fix: when there is no LSP connection, also record the text edits applied by `applyTextEdits` as history entries. The canvas does not push a model entry for these ops, so either count them as undoable on the client (`isModelChange`), or, simpler, on the server rebase the pending model entries: keep `before/after` per file and only refuse when the regions changed by the entry were modified. At minimum, do not clear the entire history on the first mismatch; drop only the stale entry.

## Triage

- Decision: `UNREVIEWED`
- Notes:
