---
status: completed
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

- [x] 5.1 Core: `ViewChange.ExcludeFromView`, `ViewChange.DeleteFromModel`.
- [x] 5.2 Server: `excludeFromView.ts` (element and deployment views), `deleteFromModel.ts` with
  a reference check.
- [x] 5.3 Diagram: replace the `Del` path, remove `deleteNodesAndEdges`, and update the snapshot
  after sync.
- [x] 5.4 UI: `ElementContextMenu`, `DeleteFromModelDialog` (loading / blocked / confirmable).

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

- [x] UT-063 — no `Del` in dynamic views
- [x] UT-064 — no affordances when read-only/stub
- [x] UT-073, UT-074 — dialog references, menu absence
- [x] UT-110, UT-111, UT-112, UT-113 — exclude variants
- [x] UT-120, UT-121, UT-122, UT-123 — delete-from-model
- [x] IT-006 — exclude round trip
- [x] E2E-003 — `Del` writes `exclude`
- [x] E2E-005 — static build has no affordances (`playwright.static-build.config.ts`)

## Completion Notes (2026-10-13)

- D6 confirmed by the owner (2026-10-13): an element or deployment node is deleted only when nothing
  references it, including view rules of the current view. Deleting a relation is never blocked.
- Server:
  - `excludeFromView.ts` appends one `exclude` per target (nodes, `src -> tgt` edges), in element
    and deployment views; dynamic views are rejected (`unsupported-in-view`).
  - `deleteFromModel.ts` uses Langium `References.findReferences`, which finds relations,
    `extend`, `instanceOf`, view rules and style rules. Nested body entries also block. The
    rejection message lists `file:line`. The definition lines are removed (comments kept, at most
    one blank line), and relations are removed by id.
- Diagram:
  - The old snapshot-only delete (`deleteNodesAndEdges`, `delete.nodes-edges`) is removed (delete
    target). `Del`/`Backspace` now go through xyflow `onBeforeDelete`: it emits
    `exclude-from-view` and returns false, so nothing is removed locally before sync.
    `deleteKeyCode` is now `['Backspace', 'Delete']`.
  - After an exclude or delete settles in a view with manual layout, the editor runs
    `latest-to-manual`, so the snapshot drops the items with no drift (`refreshManualLayout`).
  - "Delete from model" UI: a trash button in the node toolbars and on the label of a selected
    single-relation edge, plus a Mantine `Modal` (`DeleteFromModelDialog`). This deviates from
    `_uiux.md` S6 (right-click menu), which is updated. **Known limitation:** edges without a
    label have no button.
  - Client-side references (UT-073) cover relations, nested elements and deployed instances. View
    rules and `extend` are only checked by the server (`has-references`), which the client
    cannot see.
  - `editorAffordances()` holds the editing gating (UT-064).
- E2E: E2E-003 and E2E-005 (new `static-build-readonly-editing.spec.ts` in the static-build
  config), plus `US-005` (delete from model through toolbar and dialog) and `US-004 AC-4`
  (exclude in a manual-layout view updates the snapshot, no drift).
- Verification: language-server 893 passed; diagram 188 passed; `pnpm typecheck` passed (26 tasks);
  dev-server E2E 6 passed (2 runs); static-build E2E 2 passed. The lint warnings on touched files
  are pre-existing.
