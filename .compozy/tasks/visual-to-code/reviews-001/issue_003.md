---
provider: manual
pr:
round: 1
round_created_at: 2026-10-13T21:56:39Z
status: valid
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

- Decision: `VALID`
- Notes: Valid. View-level text edits (`change-element-style`, `change-autolayout`, `change-property`) are not recorded, so the next model undo is stale and clears the whole history. Fix: record them in the server history too (no LSP), and count them as undoable on the canvas, which makes style/autolayout/property changes undoable with Ctrl+Z as well. On a stale entry, drop only that entry instead of the whole history. Specs: style change then undo; stale entry keeps older ones.
- Fix: Fixed: view text edits (`change-element-style`, `change-autolayout`, `change-property`) go through `applyRecorded()` and get a history id; the canvas counts them as undoable (`isModelChange`). A stale entry is dropped alone and older entries stay. Verified by `undo.spec.ts` (issue 003 cases). Gates: `pnpm typecheck` passed (26 tasks); language-server 919 passed; diagram 200 passed; vite-plugin 40 passed + the pre-existing `detect-ai` failure; dev-server E2E 12 passed (2 runs); static-build E2E 2 passed.
