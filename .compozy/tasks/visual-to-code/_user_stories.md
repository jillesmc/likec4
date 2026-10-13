# User Stories: Visual-to-code editing (phase 1)

This is the canonical behaviour catalog for canvas → DSL editing. It is a companion to `_spec.md`
and is consumed by `_spec.md` Part II, `_uiux.md` (surface states) and `_tests.md` (coverage
matrix).

## Personas

- **Architect**: runs `likec4 start` and edits views in the browser, with `.c4` files open in any
  editor. Wants to sketch quickly and still get clean, reviewable diffs.
- **VSCode author**: edits in VSCode with the LikeC4 preview panel. Expects VSCode's dirty-buffer
  and text-undo behaviour.
- **Viewer**: opens a static site produced by `likec4 build`. Must never see editing controls.
- **Integrator**: a script or AI agent calling `likec4/change-view` (LSP) or the vite RPC
  `updateView` directly. Needs deterministic results and error codes.

## Story Index

| ID | Feature Area | Persona | Story |
|---|---|---|---|
| US-001 | Relations | Architect, VSCode author | Connect two elements to create a relation |
| US-002 | Elements | Architect, VSCode author | Drop a kind from the palette to create an element |
| US-003 | Retitle | Architect, VSCode author | Edit a node's title in place |
| US-004 | Removal | Architect, VSCode author | Hide items from one view with `Del` |
| US-005 | Removal | Architect, VSCode author | Delete an unreferenced definition from the model |
| US-006 | Undo | Architect | Undo/redo model edits from the canvas in the dev server |
| US-007 | Deployment | Architect, VSCode author | Create a deployment node from the palette |
| US-008 | Deployment | Architect, VSCode author | Deploy an element as an `instanceOf` |
| US-009 | Dynamic | Architect, VSCode author | Connect two elements to append a dynamic step |
| US-010 | Read-only | Viewer | No editing affordances on static sites |
| US-011 | Programmatic | Integrator | Apply the same ops through LSP/RPC with error codes |

## Relations

### US-001: Connect two elements to create a relation

**As an** architect, **I want** to drag from element A to element B on an element view, **so
that** `A -> B` is written to the sources without leaving the diagram.

Acceptance criteria:

- AC-1: Given an element view open in `likec4 start` showing elements `cloud.api` and `cloud.db`,
  when I drag from `api`'s connection handle and release on `db`, then a dashed edge appears
  immediately. Within the next model refresh it becomes a solid edge, and the file defining
  `cloud.api` contains a new line `-> cloud.db` as the last entry inside `api`'s block.
- AC-2: Given the same view in the VSCode preview, when I perform the same gesture, then the
  defining `.c4` document is modified, shown next to the preview, and saved by the extension.
  VSCode's Undo in that document removes the line.
- AC-3: Given a view whose predicates would not show the new relation (e.g.
  `include cloud.api`), when I connect `api` → `db`, then the same edit also appends
  `include cloud.api -> cloud.db` at the end of that view's body, and the existing rules are
  unchanged.
- AC-4: Given a view where the new relation is already visible through existing predicates, when I
  connect, then no `include` is added.
- AC-5: Every byte of the touched files outside the inserted lines is unchanged (comments,
  blank lines, ordering).

Edge cases:

- EC-1: The source is defined in another project (imported) → the relation is written as
  `cloud.api -> cloud.db` in the `model {}` of the view's file (ADR-001).
- EC-2: The source element has no body (`api = service 'API'`) → the body is added:
  `api = service 'API' {` / `-> cloud.db` / `}` with the file's indentation.
- EC-3: The source block's closing `}` is on the same line as its last content → the insertion is
  placed before that `}` on a new line, and the result parses.
- EC-4: The file uses tabs → the inserted line uses tabs.
- EC-5: Releasing on the source itself or on empty canvas → no edge, no write.
- EC-6: A relation `api -> db` already exists → a second relation is still written (LikeC4 allows
  multiple relations), and the view shows them merged as today.
- EC-7: The source or target was removed from the files after the view was rendered → the ghost
  edge disappears and a toast says `Element "cloud.db" not found` (code `not-found`). No file
  changes.
- EC-8: The edit would produce a validation error (e.g. a relation between a parent and its own
  child, if the validator forbids it) → the edit is reverted, the ghost disappears, and a toast
  shows the validator message (code `invalid-result`). The file is byte-identical.
- EC-9: VSCode refuses the edit (read-only file) → the ghost disappears and a toast shows VSCode's
  failure reason (code `apply-failed`).
- EC-10: Two connections made in quick succession → both are written, in gesture order.
- EC-11: The view has a manual-layout snapshot → the new edge is drawn without any drift badge.

## Elements

### US-002: Drop a kind from the palette to create an element

**As an** architect, **I want** to drag an element kind from a palette onto the canvas, **so
that** a new element is defined where it belongs in the model.

Acceptance criteria:

- AC-1: Given an element view, when I open the palette, then it lists exactly the element kinds
  declared in `specification {}`, in declaration order.
- AC-2: Given I drop kind `service` on the container node `cloud`, when I type the title
  `Billing API` and press Enter, then `billingApi = service 'Billing API'` is written as the last
  child inside `cloud`'s definition block, in `cloud`'s file.
- AC-3: Given I drop on empty canvas, when I confirm, then the element is written in the first
  `model {}` block of the file that defines the current view.
- AC-4: Given the new element would not be visible through the view's predicates, when the edit is
  applied, then `include <fqn>` is appended to the view in the same edit.
- AC-5: Given the view has a manual-layout snapshot, when the element appears, then it is placed
  where I dropped it, and the snapshot is updated with no drift indicator.
- AC-6: Given the view has no snapshot, when the element appears, then its position is decided by
  the automatic layout.
- AC-7: Pressing Esc in the title popover cancels. Nothing is written and no ghost remains.

Edge cases:

- EC-1: `specification {}` declares no element kinds → the palette shows `No element kinds in
  specification` and offers nothing to drag.
- EC-2: A sibling `billingApi` already exists → the identifier becomes `billingApi2`.
- EC-3: The title is empty or whitespace only → Confirm is disabled.
- EC-4: The title contains `'` → it is written escaped and the file parses.
- EC-5: The title slug is empty (e.g. `???`) → the identifier falls back to the kind name (`service`,
  then `service2`, …).
- EC-6: The drop target container is defined in another project → the drop is rejected with the
  toast `"<fqn>" is defined in another project` (code `read-only-target`).
- EC-7: The view's file has no `model {}` block → `model {` … `}` is appended at the end of that
  file, containing the element.
- EC-8: The parent is only `extend`-ed in the view's file and defined elsewhere → the element is
  written in the defining file, not in the `extend` block.
- EC-9: A kind name sent through the API is unknown → rejected (code `unknown-kind`), see US-011.

## Retitle

### US-003: Edit a node's title in place

**As an** architect, **I want** to double-click a node's title and type a new one, **so that** the
title literal in the sources changes.

Acceptance criteria:

- AC-1: Given an element defined as `api = service 'API'`, when I double-click its title, type
  `Public API` and press Enter, then the line becomes `api = service 'Public API'`.
- AC-2: Given an element whose title is set by `title 'API'` inside its body, when I retitle it,
  then that property's value is replaced and the positional strings are untouched.
- AC-3: Given an element without any title, when I retitle it, then `'<title>'` is inserted right
  after the kind/identifier.
- AC-4: Esc cancels the edit and the title is restored.

Edge cases:

- EC-1: The new title equals the current one → nothing is written.
- EC-2: An empty title → Enter is refused, the input stays open and shows an error state.
- EC-3: A deployment node → same behaviour on the `DeploymentNode` title.
- EC-4: An element shown via `instanceOf` in a deployment view → its title edit targets the
  instance (`DeployedInstance` title), not the model element.

## Removal

### US-004: Hide items from one view with `Del`

**As an** architect, **I want** `Del` to remove the selected nodes/edges from *this* view only,
**so that** I can tidy a view without touching the model.

Acceptance criteria:

- AC-1: Given node `cloud.db` is selected in an element view, when I press `Del`, then
  `exclude cloud.db` is appended to the view's body, the node disappears, and no model block
  changes.
- AC-2: Given an edge between `cloud.api` and `cloud.db` is selected, when I press `Del`, then
  `exclude cloud.api -> cloud.db` is appended.
- AC-3: Given several items are selected, when I press `Del`, then one edit appends one `exclude`
  line per item.
- AC-4: Given the view has a manual-layout snapshot, when the items disappear, then the snapshot is
  updated and no drift badge appears.

Edge cases:

- EC-1: A deleted container cascades to its selected children → each removed node gets its own
  `exclude`.
- EC-2: In a dynamic view → `Del` does nothing on the canvas (Q5 default).
- EC-3: In a deployment view → `exclude <deploymentFqn>` is written (the grammar supports it).
- EC-4: An item already excluded by an earlier rule but still visible through a later include →
  the new `exclude` is appended last and wins.

### US-005: Delete an unreferenced definition from the model

**As an** architect, **I want** an explicit "Delete from model" action, **so that** I can remove a
definition safely, never by accident.

Acceptance criteria:

- AC-1: Given a node's context menu, when I choose "Delete from model", then a dialog opens listing
  every reference to that element: relations, nested children, `instanceOf`, `extend`, dynamic
  steps, and view rules, each with file and line.
- AC-2: Given the list is non-empty, then the dialog has no Delete button and says `Remove these
  references first`.
- AC-3: Given the element has no references, when I confirm, then its whole definition (including
  its body) is removed. Surrounding lines and comments are untouched, and the node disappears.
- AC-4: Given an edge that represents exactly one relation, when I choose "Delete from model" and
  confirm, then that relation's statement is removed. The dialog lists the views showing it, for
  information only.

Edge cases:

- EC-1: An edge aggregating more than one relation → "Delete from model" is not in its menu.
- EC-2: References appear in another file between opening the dialog and confirming → the server
  rejects the delete (code `has-references`), and a toast lists the new references.
- EC-3: The element is referenced only by an `include` in the current view → it is still blocked.
  The dialog shows that rule.
- EC-4: A definition defined in another project → the action is absent.

## Undo

### US-006: Undo/redo model edits from the canvas in the dev server

**As an** architect using `likec4 start`, **I want** Ctrl+Z / Ctrl+Shift+Z on the canvas to undo
and redo my model edits as well as my layout edits, **so that** a wrong gesture is cheap to fix.

Acceptance criteria:

- AC-1: Given I just connected `api` → `db`, when I press Ctrl+Z on the canvas, then the inserted
  lines are removed from the file(s) and the edge disappears.
- AC-2: When I then press Ctrl+Shift+Z, then the lines are re-inserted.
- AC-3: Model and layout edits undo in the reverse order I made them, as one history.

Edge cases:

- EC-1: The file was edited outside the canvas since that edit → undo is refused with the toast
  `File changed since this edit; undo unavailable` (code `stale-undo`), and the model history is
  cleared.
- EC-2: The dev server was restarted → no model entries remain, and Ctrl+Z affects only layout
  history.
- EC-3: More than 100 model edits → the oldest are no longer undoable.
- EC-4: In the VSCode preview → canvas Ctrl+Z affects only layout. Model edits are undone through
  the `.c4` document's own Undo.

## Deployment

### US-007: Create a deployment node from the palette

**As an** architect, **I want** the palette in a deployment view to list deployment-node kinds,
**so that** I can add infrastructure on the canvas.

Acceptance criteria:

- AC-1: Given a deployment view, then the palette lists the deployment-node kinds from
  `specification {}`.
- AC-2: Dropping kind `vm` on deployment node `prod.eu` with title `Worker` writes `worker = vm
  'Worker'` inside `prod.eu`'s block.
- AC-3: Dropping on empty canvas writes into the first `deployment {}` of the view's file, creating
  that block at the end of the file if it is absent.

Edge cases:

- EC-1: No deployment kinds in the specification → the palette shows `No deployment node kinds in
  specification`.
- EC-2: Identifier collision, empty title and visibility behave as in US-002 (EC-2, EC-3, AC-4).

### US-008: Deploy an element as `instanceOf`

**As an** architect, **I want** to drop an "Instance" item on a deployment node and choose a model
element, **so that** `instanceOf <fqn>` is written.

Acceptance criteria:

- AC-1: Given I drop the palette's "Instance" item on `prod.eu.worker`, when I pick `cloud.api` in
  the element search and press Enter, then `instanceOf cloud.api` is written inside `worker`'s
  block.
- AC-2: Given an instance of `cloud.api` already exists in the same node, then the new one is
  written as `api2 = instanceOf cloud.api`.

Edge cases:

- EC-1: Dropped on empty canvas → not accepted (an instance needs a parent node), and the drop
  indicator shows "drop on a deployment node".
- EC-2: The chosen element was deleted meanwhile → code `not-found`, toast, no write.

## Dynamic

### US-009: Connect two elements to append a dynamic step

**As an** architect, **I want** connecting A → B in a dynamic view to add a step, **so that** I
can sketch a flow on the canvas.

Acceptance criteria:

- AC-1: Given dynamic view `checkout`, when I connect `web` → `api`, then `web -> api` is appended
  after the last top-level step of the view body. No model relation is created.
- AC-2: Given the view has parallel/alt blocks, the new step goes after them at top level, not
  inside.

Edge cases:

- EC-1: Connecting to a node that is not an element (e.g. a group) → no connection is offered.
- EC-2: The model has no relation `web -> api` → the step is still written, with the same
  behaviour as hand-written DSL (any diagnostics are the existing ones). If the language server
  marks it as an error, the guard reverts (code `invalid-result`).

## Read-only

### US-010: No editing affordances on static sites

**As a** viewer of a `likec4 build` site, **I want** the diagram to be purely navigational, **so
that** I never see controls that cannot work.

Acceptance criteria:

- AC-1: Given a static build, then there are no connection handles, no palette, no title editing,
  no "Delete from model", and `Del` has no effect.
- AC-2: Given the SPA with RPC available but `enableReadOnly` set, the same holds.

## Programmatic

### US-011: Apply the same ops through LSP/RPC with error codes

**As an** integrator, **I want** to send the new `ViewChange` ops to `likec4/change-view` or
`updateView`, **so that** scripts and agents can edit models exactly like the canvas.

Acceptance criteria:

- AC-1: Given a valid `add-relation` op, the response is `{ success: true, location }`, and
  `location` points at the inserted text.
- AC-2: Given any rejected op, the response is `{ success: false, error, code }` with a code from
  `_dx.md` §Errors. Through the vite RPC the call rejects with the message.
- AC-3: Ops sent concurrently for the same project are applied one at a time in arrival order.

Edge cases:

- EC-1: An `add-element` with a `name` not matching the identifier grammar → code `invalid-name`.
- EC-2: An `add-element` with an explicit `name` that collides with an existing sibling → code
  `name-collision` (no auto-suffix when the name is explicit).
- EC-3: An `add-dynamic-step` against an element view → code `unsupported-in-view`.
- EC-4: An `undoChange` with an empty stack → `{ success: false, code: 'not-found' }`.
