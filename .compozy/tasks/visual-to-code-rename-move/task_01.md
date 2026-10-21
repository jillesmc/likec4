---
status: pending
title: 'Task 01: Rename engine for elements: references, guard, snapshots, undo'
type: backend
complexity: high
---

# Task 01: Rename engine for elements: references, guard, snapshots, undo

## Overview

The server side of renaming an element: the `rename-element` op, the reference planner, the
resolution guard, the snapshot rewrite and history entries that carry snapshots. Consumer: task 02
(canvas), then tasks 03, 04, 05 and 07 extend the planner.

## Shippable Outcome

- Outcome: `likec4/change-view` and the vite RPC `updateView` accept
  `{ op: 'rename-element', target: { element }, name }`. The definition and every reference in the
  project are rewritten in one edit; snapshots of every view follow; capture is refused; canvas
  undo/redo restores files and snapshots. The success result carries `viewId` when the current
  view's id changed.
- Verify in this task: the unit and integration cases below.
- Integration verification: IT-001, IT-002, IT-003, IT-005, IT-006, IT-007.

## Requirements

- `_spec.md` rules 1–4, 8–11; Core Interfaces; Data Models; ADR-001, ADR-002.
- `_dx.md` Ops (`rename-element`, element target), Results, Errors (`not-found`, `invalid-name`,
  `name-collision`, `read-only-target`, `invalid-result`, `stale-undo`).
- `this` / `it` and imported aliases are never rewritten. Element targets only here; deployment
  targets are task 03, importing projects task 04.
- Add `invalid-parent` to `ViewChangeErrorCode` here too (one core change for both ops).

## Subtasks

- [ ] 1.1 Core: `ViewChange.RenameElement`, `ViewChange.MoveElement` types, `invalid-parent`;
      `renameFqnsInSnapshot(view, fqnMap)` in `core/src/manual-layout/`. `pnpm exec tsc --build`.
- [ ] 1.2 Server: `model-change/_references.ts` (`planRename` for elements, `fqnMap`, `viewIdMap`),
      `renameElement.ts` handler with preconditions.
- [ ] 1.3 Server: `_guard.ts` resolution baseline and comparison in `ModelChanges.applyChange`.
- [ ] 1.4 Server: snapshot rewrite through `LikeC4ManualLayouts` (move file on view id change);
      history entries with `snapshots`; undo/redo write them back.
- [ ] 1.5 Protocol: `viewId?` on the `ChangeView.Res` success branch; vite RPC passes it through.

## Implementation Details

### Relevant Files

- `packages/core/src/types/view-changes.ts`; `packages/core/src/manual-layout/`.
- `packages/language-server/src/model-change/ModelChanges.ts`, `deleteFromModel.ts`
  (`findReferences`), `_lookup.ts`, `ModelChangeError.ts`.
- `packages/language-server/src/references/scope-provider.ts`, `model/fqn-index.ts`.
- `packages/language-server/src/filesystem/LikeC4ManualLayouts.ts`.
- `packages/language-server/src/model/parser/ViewsParser.ts:100` (unnamed view ids).
- `packages/language-server/src/protocol.ts`; `packages/vite-plugin/src/rpc/functions/updateView.ts`.

## Tests

- [ ] UT-001 – UT-011 — definition and every reference kind; `this`/`it`; unnamed instances follow
- [ ] UT-013, UT-014, UT-015 — no-op, `invalid-name`, `name-collision`
- [ ] UT-040, UT-041, UT-042 — snapshot mapping, no drift, snapshot moved on view id change
- [ ] IT-001, IT-002, IT-003, IT-005, IT-006, IT-007
