---
status: completed
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

- [x] 3.1 Core: `ViewChange.AddElement`.
- [x] 3.2 Server: `_naming.ts`, `addElement.ts`, preconditions (`unknown-kind`, `invalid-name`,
  `name-collision`, `read-only-target`).
- [x] 3.3 UI: `EditorPalette`, `DropPopover` (title input, Esc cancel), drop handling with the
  container under the cursor as parent, and the ghost node.
- [x] 3.4 D12 snapshot placement after sync.

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

- [x] UT-013, UT-014, UT-015, UT-016 — element placement
- [x] UT-020, UT-021, UT-022, UT-023, UT-024 — identifier derivation and escaping
- [x] UT-041, UT-042, UT-043, UT-044 — preconditions
- [x] UT-062 — snapshot queued with the drop position
- [x] UT-070, UT-071, UT-072 — palette list/empty, popover cancel/disabled
- [x] E2E-002 — drop in a manual-layout view, no drift badge

## Completion Notes (2026-10-13)

- Q2 default applied: the identifier is derived from the title (`_naming.ts`: diacritics stripped,
  apostrophes joined so `It's` becomes `its`, camelCase, numeric suffix on collision, falls back to
  the kind when the slug is empty or starts with a digit).
- Server: `addElement.ts`. Unknown kind, explicit-name validation/collision, and a parent from
  another project (`read-only-target`) are rejected. The element is written into the parent's
  *definition* (never `extend`), or into the first `model {}` of the view file (created when
  missing). `include <fqn>` is added only when the element would be hidden (`isElementVisible`).
- UI (`packages/diagram/src/editor-ui/`):
  - `ElementPalette` is a plain HTML panel in an xyflow `Panel` (center-right), listing the
    specification kinds.
  - `useElementDrop`: on drop, the innermost element under the pointer becomes the parent, then
    `DropPopover` asks for the title (prefilled `New <kind>`; Enter confirms, Esc cancels).
  - `Ghosts` renders both ghost relations and ghost elements (dashed box at the drop point).
- D12: ghosts now carry the drop position. When an `add-element` ghost settles and the view has a
  manual layout, the editor runs `latest-to-manual` with a `placement`, and `placeNewNode`
  centers the new leaf node at the drop point. The snapshot is then saved; E2E-002 asserts it
  contains the element.
- UT-062 is covered by the pure `placeNewNode` spec plus E2E-002 (an actor-level test would need
  the full diagram actor system).
- One tagged-type cast remains in `DiagramXYFlow.tsx`: specification keys are converted to
  `ElementKind`, because `Object.keys` loses the tag.
- Verification: language-server 876 passed; diagram 176 passed; `pnpm typecheck` passed (26 tasks);
  E2E-001 and E2E-002 passed 3/3; oxlint is clean on the changed files (pre-existing
  `ViewPaddings` warning).
