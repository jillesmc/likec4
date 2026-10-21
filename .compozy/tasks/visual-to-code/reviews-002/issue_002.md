---
provider: manual
pr:
round: 2
round_created_at: 2026-10-21T00:46:08Z
status: pending
file: packages/diagram/src/likec4diagram/DiagramXYFlow.tsx
line: 352
severity: medium
author: claude-code
provider_ref:
---

# Issue 002: Relation title editor is prefilled with the view label, not the title

## Review Comment

On double-click of a relation edge, the inline editor is prefilled with `edge.data.label`, and the same value is used to detect "no change" in `useTitleEditing`. The edge label is the label computed for the **view**, which a view rule can override (e.g. `include a -> b with { title 'Calls' }`), while the edit is written to the **relation** in the model.

Scenario: relation `api -> db 'reads'`, view `include api -> db with { title 'queries' }`. Double-click shows `queries`; pressing Enter without changes writes `'queries'` as the relation title (unintended model change), and any real edit is not visible on that view because the view rule still overrides the label. US-014 AC-1 expects the editor to start from the relation's title.

Suggested fix: prefill from the model relation (`likec4model.findRelationship(relationId)?.title ?? ''`, the model is already available in `DiagramXYFlow`), and compare against that value for the no-op check. Optionally show that the view overrides the label.

## Triage

- Decision: `UNREVIEWED`
- Notes:
