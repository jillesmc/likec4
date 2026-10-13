---
provider: manual
pr:
round: 1
round_created_at: 2026-10-13T21:56:39Z
status: pending
file: packages/language-server/src/model-change/ModelChanges.ts
line: 373
severity: low
author: claude-code
provider_ref:
---

# Issue 012: Undo history keeps full file texts (memory)

## Review Comment

Each history entry stores the complete `before` and `after` text of every touched file, up to 100 entries per project, plus the redo stack. For large `.c4` files (e.g. generated models of several hundred KB) a long editing session in `likec4 start` can keep tens of MB in memory.

Suggested fix: store only the edited ranges (inverse `TextEdit`s, as ADR-003 originally proposed) plus a hash of the file for the stale check, or cap the history by total bytes instead of entry count.

## Triage

- Decision: `UNREVIEWED`
- Notes:
