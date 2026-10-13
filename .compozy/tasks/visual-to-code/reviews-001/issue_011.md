---
provider: manual
pr:
round: 1
round_created_at: 2026-10-13T21:56:39Z
status: pending
file: packages/diagram/src/editor-ui/palette.ts
line: 37
severity: low
author: claude-code
provider_ref:
---

# Issue 011: Palette data recomputed on every DiagramXYFlow render

## Review Comment

`canvasPalette()` is called on every `LikeC4DiagramXYFlow` render. In deployment views it builds `[...model.elements()].map(...)` (all element FQNs) and new item/config objects every time. `ElementPalette`, the drop handlers and the datalist then re-render with all elements. `DiagramXYFlow` renders often (selection, viewport, editor state), so this is avoidable work on large models.

Suggested fix: memoize with `useMemo(() => canvasPalette(viewType, likec4model), [viewType, likec4model, itemsCreatable])` in `DiagramXYFlow`, and drop the unnecessary `e.id as string` cast (`Fqn` is already a string).

## Triage

- Decision: `UNREVIEWED`
- Notes:
