---
status: pending
title: "Task 3: Palette and add-element with manual-layout placement"
type: feature
complexity: high
---

# Task 3: Palette and add-element with manual-layout placement

## Overview

An architect drags an element kind from a palette onto the canvas or into a container, types a
title, and gets a correctly nested element definition. In views with a manual layout, the node
lands where it was dropped, without drift.

## Shippable Outcome

- Outcome: the palette (S3) plus the drop popover (S4) produce `add-element`. The server writes it
  per Business Rules 3, 5 and 6, with auto-include. In manual-layout views a `save-view-snapshot`
  follows, placing the node at the drop point.
- Verify in this task: the handler, naming and UI specs below, plus E2E-002.
- Integration verification: none.

## Requirements

- `_spec.md` Business Rules 3, 5, 6, 7; Key Decision "D12 snapshot update client-side"; Q7 default
  (no new drift reason).
- The palette lists only `specification {}` element kinds, in declaration order (D10).
- Identifier derivation and dedupe happen server-side (`_naming.ts`). An explicit `name` is never
  auto-suffixed.
- Placement uses `ModelLocator.locateElement` to find the *definition*, never an `extend`
  (US-002 EC-8).
- D12: after `view.synched`, if a manual snapshot exists, merge with
  `applyChangesToManualLayout`, override the new node's position with the ghost's drop position,
  and queue `save-view-snapshot`.

## Subtasks

- [ ] 3.1 Core: `ViewChange.AddElement`.
- [ ] 3.2 Server: `_naming.ts`, `addElement.ts`, preconditions (`unknown-kind`, `invalid-name`,
  `name-collision`, `read-only-target`).
- [ ] 3.3 UI: `EditorPalette`, `DropPopover` (title input, Esc cancel), drop handling with the
  container under the cursor as parent, and the ghost node.
- [ ] 3.4 D12 snapshot placement after sync.

## Implementation Details

### Relevant Files

- `packages/diagram/src/editor/applyChangesToManualLayout.ts` — merge to reuse.
- `packages/core/src/types/view-manual-layout.ts:14-40` — drift reasons that must not appear.
- `packages/language-server/src/like-c4.langium:126-150,1267` — element syntax, `IdTerminal`.
- `packages/language-server/src/model/model-locator.ts:116-129` — `locateElement`.
- `packages/language-server/src/filesystem/LikeC4ManualLayouts.ts:214-255` — snapshot write (Q8).

## Deliverables

- The add-element op end-to-end, the palette and popover, and the D12 placement.

## Tests

- [ ] UT-013, UT-014, UT-015, UT-016 — element placement
- [ ] UT-020, UT-021, UT-022, UT-023, UT-024 — identifier derivation and escaping
- [ ] UT-041, UT-042, UT-043, UT-044 — preconditions
- [ ] UT-062 — snapshot queued with the drop position
- [ ] UT-070, UT-071, UT-072 — palette list/empty, popover cancel/disabled
- [ ] E2E-002 — drop in a manual-layout view, no drift badge
