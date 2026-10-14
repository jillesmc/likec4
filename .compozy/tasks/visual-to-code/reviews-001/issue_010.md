---
provider: manual
pr:
round: 1
round_created_at: 2026-10-13T21:56:39Z
status: valid
file: packages/diagram/src/likec4diagram/custom/edges/RelationshipEdge.tsx
line: 68
severity: medium
author: claude-code
provider_ref:
---

# Issue 010: O(E^2) edge lookup on every render in edit mode

## Review Comment

In edit mode every `RelationshipEdge` render calls `diagram.findDiagramEdge(props.id)`, which reads the actor snapshot and linearly scans `view.edges`. All edges re-render together on many diagram updates (hover, selection, viewport-driven updates), so the cost is O(E) per edge and O(E^2) per render pass. This is noticeable on large views. The value is only used when the edge is `selected`.

Suggested fix: compute the relations only when needed, e.g. `const edgeRelations = enabledEditing && selected ? diagram.findDiagramEdge(...)?.relations ?? [] : []`, or pass the relation ids through the xyflow edge data (`RelationshipEdgeData`) when edges are converted.

## Triage

- Decision: `VALID`
- Notes: Valid. `findDiagramEdge` (linear scan) runs on every render of every edge in edit mode. Fix: compute the relations only when the edge is selected.
- Fix: Fixed: the relations are looked up only when the edge is selected. Gates: `pnpm typecheck` passed (26 tasks); language-server 919 passed; diagram 200 passed; vite-plugin 40 passed + the pre-existing `detect-ai` failure; dev-server E2E 12 passed (2 runs); static-build E2E 2 passed.
