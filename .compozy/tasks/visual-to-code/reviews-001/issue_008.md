---
provider: manual
pr:
round: 1
round_created_at: 2026-10-13T21:56:39Z
status: valid
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

- Decision: `VALID`
- Notes: Valid. The relation delete button lives inside `EdgeLabel`, which is absent for unlabeled edges (all canvas-created relations). Fix: when the edge has no label, render the button through `EdgeLabelRenderer` at the label position the edge already computes. E2E: connect, select edge, delete from model.
- Fix: Fixed: for unlabeled edges, the button is rendered through `EdgeLabelContainer` at the middle point of the edge, wrapped with `pointerEvents: 'all'`. Verified by E2E 'review 008: a relation without label can be deleted from the model'. Gates: `pnpm typecheck` passed (26 tasks); language-server 919 passed; diagram 200 passed; vite-plugin 40 passed + the pre-existing `detect-ai` failure; dev-server E2E 12 passed (2 runs); static-build E2E 2 passed.
