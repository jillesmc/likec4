---
status: pending
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

- [ ] 13.1 Diagram: notice in `ElementPalette.tsx`; first-drop info toast from the drop flow.

## Implementation Details

### Relevant Files

- `packages/diagram/src/editor-ui/ElementPalette.tsx`, `useCanvasDrop.tsx`, `palette.spec.tsx`.
- `packages/core/src/types/view-manual-layout.ts` — how a view carries its manual layout.

## Tests

- [ ] UT-250 — notice only in manual-layout views
- [ ] UT-251 — toast on the first drop only
- [ ] UT-252 — no notice when read-only
