---
provider: manual
pr:
round: 1
round_created_at: 2026-10-13T21:56:39Z
status: pending
file: packages/diagram/src/likec4diagram/custom/edges/RelationshipEdge.tsx
line: 341
severity: medium
author: claude-code
provider_ref:
---

# Issue 008: Delete-from-model unreachable for unlabeled edges (US-005 AC-4)

## Review Comment

The "Delete from model" button for relations is rendered inside `EdgeLabel`, which only exists when the edge has a label (`labelBBox`). Relations created on the canvas (task 02) have no title, so the relations users create with this feature cannot be deleted from the model through the UI. US-005 AC-4 ("given an edge that represents exactly one relation, choose Delete from model and confirm") is only met for labeled edges. The limitation is recorded in task_05 but has no follow-up.

Suggested fix: render the button for selected, deletable edges independently of the label, e.g. through `EdgeLabelRenderer` at the edge midpoint (the same position control points use), or add the action to the existing edge context menu callback. Add an E2E: connect two elements, select the edge, delete it from the model.

## Triage

- Decision: `UNREVIEWED`
- Notes:
