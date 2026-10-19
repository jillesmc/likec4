---
status: completed
title: "Task 13: Manual-layout notice when adding elements"
type: feature
complexity: low
---

# Task 13: Manual-layout notice when adding elements

## Overview

In a view with a manual-layout snapshot, the user is told that new elements stay where they are
dropped and must be positioned by hand. Owner decision Q7, 2026-10-18.

## Shippable Outcome

- Outcome: the palette shows the notice from Business Rule 18 in manual-layout views, and the
  first new element dropped in such a view during the session shows an info toast with the same
  text. No drift reason is added.
- Verify in this task: the specs below, plus a manual check in `likec4 start`.
- Integration verification: none.

## Requirements

- `_spec.md` Business Rule 18; `_uiux.md` S12; `_user_stories.md` US-017.
- Detect the manual layout from the view data the diagram already has (no new port or RPC).
- "Once per view per session" lives in diagram UI state for the editor's lifetime; nothing is
  persisted.
- Hidden in read-only and auto-layout views.

## Subtasks

- [x] 13.1 Diagram: notice in `ElementPalette.tsx`; first-drop info toast from the drop flow.

## Implementation Details

### Relevant Files

- `packages/diagram/src/editor-ui/ElementPalette.tsx`, `useCanvasDrop.tsx`, `palette.spec.tsx`.
- `packages/core/src/types/view-manual-layout.ts` — how a view carries its manual layout.

## Tests

- [x] UT-250 — notice only in manual-layout views
- [x] UT-251 — toast on the first drop only
- [x] UT-252 — no notice when read-only

## Completion Notes (2026-10-18)

- Diagram: `ElementPalette` shows an optional `notice`; `DiagramXYFlow` passes `MANUAL_LAYOUT_NOTICE`
  when the view has `_layout === 'manual'`. `editor-ui/ManualLayoutNotice.tsx`:
  `useManualLayoutToast` shows a blue Mantine notification (auto-close 6 s) on the first element
  dropped in a manual-layout view; `takeManualLayoutToast` remembers the views in a module-level set
  (once per view per page session, nothing persisted).
- UT-252 (no notice when read-only) needs no new case: without editing the palette is not rendered
  at all (UT-064, `editorAffordances`).
- E2E-002 also checks the palette notice and the toast.
- Verification: diagram 224 passed; `pnpm typecheck` 26/26; dev-server E2E 17 passed; static-build
  E2E 2 passed.

