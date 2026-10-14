---
provider: manual
pr:
round: 1
round_created_at: 2026-10-13T21:56:39Z
status: valid
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

- Decision: `VALID`
- Notes: Valid. The history keeps full texts, up to 100 entries. Fix: also cap the history by total size (oldest entries are dropped while the stored texts exceed 20 MB per project). Spec on the cap.
- Fix: Fixed: the history is also capped by total text size (`historyMaxSize`, 20M characters by default). Verified by `undo.spec.ts` (issue 012). Gates: `pnpm typecheck` passed (26 tasks); language-server 919 passed; diagram 200 passed; vite-plugin 40 passed + the pre-existing `detect-ai` failure; dev-server E2E 12 passed (2 runs); static-build E2E 2 passed.
