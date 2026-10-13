---
status: pending
title: "Task 5: Exclude from view and delete from model"
type: feature
complexity: high
---

# Task 5: Exclude from view and delete from model

## Overview

`Del` now hides the selected items from the current view by writing `exclude` rules, instead of
only editing the layout snapshot. A context-menu "Delete from model" removes an unreferenced
definition, after a dialog that lists blocking references.

## Shippable Outcome

- Outcome: `Del` → `exclude-from-view` (US-004). The context menu → dialog →
  `delete-from-model` (US-005), blocked per Business Rule 9 on both client and server. Static
  builds show none of the editing affordances (US-010).
- Verify in this task: the specs below, plus E2E-003 and E2E-005.
- Integration verification: none.

## Requirements

- **Delete target**: `deleteNodesAndEdges` and the `delete.nodes-edges` handling in
  `state.sync-queue.ts` are removed in this task (hard cut, no fallback, `_spec.md` Impact
  Analysis). `onDelete` emits `change.view` with `exclude-from-view`.
- Manual-layout views: after sync, the snapshot is updated so that no `removed` drift appears
  (same mechanism as D12).
- No `Del` in dynamic views (Q5 default).
- The dialog computes references client-side from the in-memory `LikeC4Model`, and the server
  re-checks (`has-references`).
- Deleting removes the whole definition range (including the body), and keeps the comments above
  it and at most one blank line.
- This task owns the read-only affordance checks (UT-064, E2E-005) because it adds the last MVP
  affordance (the context menu).

## Subtasks

- [ ] 5.1 Core: `ViewChange.ExcludeFromView`, `ViewChange.DeleteFromModel`.
- [ ] 5.2 Server: `excludeFromView.ts` (element and deployment views), `deleteFromModel.ts` with
  a reference check.
- [ ] 5.3 Diagram: replace the `Del` path, remove `deleteNodesAndEdges`, and update the snapshot
  after sync.
- [ ] 5.4 UI: `ElementContextMenu`, `DeleteFromModelDialog` (loading / blocked / confirmable).

## Implementation Details

### Relevant Files

- `packages/diagram/src/likec4diagram/DiagramXYFlow.tsx:284-292` — the current `onDelete`.
- `packages/diagram/src/editor/actor/actions.ts:159-210` — `deleteNodesAndEdges` (delete target).
- `packages/diagram/src/editor/actor/state.sync-queue.ts:37,81` — `delete.nodes-edges`
  transitions.
- `packages/language-server/src/like-c4.langium:352-444,935-938` — exclude rules (none in dynamic
  views).
- `packages/language-server/src/model/model-locator.ts:116-160` — locate the element/relation
  definition ranges.

## Tests

- [ ] UT-063 — no `Del` in dynamic views
- [ ] UT-064 — no affordances when read-only/stub
- [ ] UT-073, UT-074 — dialog references, menu absence
- [ ] UT-110, UT-111, UT-112, UT-113 — exclude variants
- [ ] UT-120, UT-121, UT-122, UT-123 — delete-from-model
- [ ] IT-006 — exclude round trip
- [ ] E2E-003 — `Del` writes `exclude`
- [ ] E2E-005 — static build has no affordances (`playwright.static-build.config.ts`)
