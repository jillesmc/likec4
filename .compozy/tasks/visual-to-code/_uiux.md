# UI/UX Change Map: Visual-to-code editing (phase 1)

These are the diagram UI surfaces the feature touches: where each lives today, what changes, which
states change, and any named visual reference. LikeC4 has no artboard library; every surface is
`none — no named visual reference` and must use the existing Mantine components and PandaCSS
tokens (`styled-system/preset`).

Companions: `_spec.md` Part I (behaviour authority), `_user_stories.md` (the states come from
ACs/ECs), `_dx.md` (the non-UI half of the surface).

## Design constraints

- **Truthful UI**: affordances are *absent* (not disabled) when `enableReadOnly` is true or the
  editor port is a stub (US-010). A pending item is always visually distinct from a confirmed one.
- **Ghost style**: a dashed border/stroke at reduced opacity, reusing the existing `dimmed`-style
  tokens. There are no new colour tokens.
- **Keyboard**: the palette is reachable by Tab; the title editor commits with Enter and cancels
  with Esc; the dialog is a Mantine `Modal` (focus trap, Esc closes).
- **Copy**: short and imperative. Messages come from `_dx.md` §Errors verbatim.
- **Hotkeys**: `Del`/`Backspace` keep xyflow's default binding. Ctrl+Z / Ctrl+Shift+Z keep the
  existing `hotkey.ts` bindings.

## Surface map

| # | Surface | Kind | Core change | Stories |
|---|---|---|---|---|
| S1 | Node connection handles | new | Drag-to-connect between nodes | US-001, US-009 |
| S2 | Ghost node / ghost edge | new | Pending rendering until sync, removed on failure | US-001, US-002, US-007, US-008, US-009 |
| S3 | Element palette | new | Kinds from specification, drag source | US-002, US-007, US-008 |
| S4 | Drop popover (title / element search) | new | Title input, or element picker for instances | US-002, US-007, US-008 |
| S5 | Inline title editor | new | Double-click title → input | US-003 |
| S6 | Node/edge context menu | new | "Delete from model" entry | US-005 |
| S7 | Delete-from-model dialog | new | References list or confirm | US-005 |
| S8 | `Del` behaviour | modify | Writes `exclude` instead of a snapshot-only removal | US-004 |
| S9 | Error toasts | new usage | One toast per rejected gesture | all |

### S1. Node connection handles

- **Today**: no `onConnect` and no connectable handles. Edges are read-only geometry
  (`packages/diagram/src/likec4diagram/DiagramXYFlow.tsx`).
- **Change**: in edit mode, element/deployment nodes show source/target handles on hover. A
  connection line follows the cursor, and dropping on a valid node fires the gesture.
- **States**: hidden (read-only / stub, including the SPA's default locked state until the user
  unlocks editing), idle (source handle shown as a dot on the node's right edge on hover), dragging (connection
  line), invalid target (no snap: self, empty canvas, or group node in a dynamic view —
  US-001.EC-5, US-009.EC-1).

### S2. Ghost node / ghost edge

- **Change**: rendered from `editor` actor `ghosts`. A ghost node appears at the drop position; a
  ghost edge goes between its endpoints.
- **States**: pending (dashed); confirmed (replaced by the real node/edge on `view.synched`);
  rejected (removed and S9 shown).

### S3. Element palette

- **Change**: a collapsible panel in the existing controls area, with one draggable item per kind
  (shape icon + kind name). In deployment views it lists deployment-node kinds plus an "Instance"
  item.
- **States**: hidden (read-only), list, empty (`No element kinds in specification` /
  `No deployment node kinds in specification`, US-002.EC-1, US-007.EC-1), dynamic view (the palette
  is hidden; dynamic views only use S1).

### S4. Drop popover

- **Change**: anchored at the drop point. For elements and deployment nodes: a title input
  prefilled `New <kind>` with Confirm. For instances: a searchable list of model elements
  (Mantine `Combobox`).
- **States**: open, confirm disabled (empty title, US-002.EC-3), cancelled (Esc, US-002.AC-7),
  invalid drop for instance on empty canvas (indicator `Drop on a deployment node`,
  US-008.EC-1).

### S5. Inline title editor

- **Today**: titles are static text in the node components (`base-primitives`).
- **Change**: double-click replaces the title with an `<input>` of the same size.
- **States**: editing, empty-error (US-003.EC-2), committed (stays visible until sync), cancelled.

### S6. "Delete from model" entry

- **Change (as implemented)**: instead of a right-click menu, there is a "Delete from model"
  (trash) button in the existing node toolbar (element, compound and deployment nodes) and on the
  label of a selected edge. Edges without a label have no button yet.
- **Original change**: right-click on a node or edge in edit mode shows "Delete from model". It is absent
  for edges aggregating more than one relation (US-005.EC-1) and for definitions from other
  projects (US-005.EC-4).

### S7. Delete-from-model dialog

- **Change**: a Mantine `Modal`. The title is `Delete "<title>" from model?`.
- **States**:
  - loading (references being computed);
  - blocked (list of `file:line — kind of reference`, text `Remove these references first`, no
    Delete button, US-005.AC-2);
  - confirmable (`Delete` danger button; for relations, an informational list of views,
    US-005.AC-4);
  - server-rejected (S9 with the new references, US-005.EC-2).
- References are computed client-side from the `LikeC4Model` already in memory (relations,
  children, instances and view rules are all present in the model data). There is no new read
  RPC; the server re-checks on apply (US-005.EC-2). File and line come from the model's source
  locations where available; otherwise only the view/relation name is shown.

### S8. `Del` behaviour

- **Today**: `onDelete` → `delete.nodes-edges` → `deleteNodesAndEdges` removes the nodes from the
  manual snapshot only (`DiagramXYFlow.tsx:284-292`, `editor/actor/actions.ts:159-210`).
- **Change**: `onDelete` → `change.view` with `exclude-from-view`. In manual-layout views the
  snapshot is updated after sync, like D12. No `Del` in dynamic views (Q5).

### S9. Error toasts

- **Change**: the existing Mantine notifications are used, with the message from `_dx.md`
  §Errors, red/error variant, auto-close after 6 s.

## Component plan

### Rules

- New UI lives in `packages/diagram/src/editor-ui/` (a sibling feature). It consumes the editor
  actor through hooks, and never imports `likec4diagram/state` internals beyond existing public
  hooks.
- Ghost rendering reuses the existing node/edge components with a `pending` data flag. There is no
  separate ghost component tree.

### New primitives

None. Mantine `Popover`, `Modal`, `Combobox`, `TextInput`, `Menu` and notifications cover
everything.

### New domain components

- `EditorPalette` (S3), `DropPopover` (S4), `InlineTitleEditor` (S5), `ElementContextMenu` (S6),
  `DeleteFromModelDialog` (S7) — all in `editor-ui/`.

### Signal & state mapping

| State | Primitive / token |
|---|---|
| pending (ghost) | existing node/edge with dashed stroke + the `dimmed` opacity token |
| rejected | Mantine notification, `color="red"` |
| blocked delete | Modal body list, no action button |
| danger confirm | Mantine `Button color="red"` |
