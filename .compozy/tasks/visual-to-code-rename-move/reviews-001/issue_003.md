---
provider: manual
pr:
round: 1
round_created_at: 2026-10-21T20:27:26Z
status: pending
file: packages/language-server/src/model-change/moveElement.spec.ts
line: 1
severity: low
author: claude-code
provider_ref:
---

# Issue 003: No test covers the manual-layout snapshot after a move

## Review Comment

`_spec.md` rule 9 and US-003 AC-6 say a move keeps the node's position in manual layouts (ids
mapped to the new FQN; drift only when the new parent is shown in the view). The rename path is
covered (IT-002, IT-003, IT-006), but no spec moves an element in a workspace with snapshots, and
the `_tests.md` coverage matrix has no row for US-003 AC-6. A regression in the move's `renames`
(e.g. a missing prefix mapping for descendants) would go unnoticed.

Verified behaviour with a throwaway spec: after `move-element cloud.db → billing` the snapshot holds
`billing.db`, and the view reports `nodes-drift` because `billing` is shown (as the spec allows).

Suggested fix: add a moveElement IT with `manualLayouts: true`: snapshot rewritten with the new
FQNs (moved element and a descendant), no drift when the new parent is not in the view, drift
reported when it is; add the row to the `_tests.md` coverage matrix.

## Triage

- Decision: `UNREVIEWED`
- Notes:
