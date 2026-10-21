# User Stories: Visual-to-code editing, phase 2 (rename and move)

Companion to `_spec.md` Part I. Personas: _Architect_ (`likec4 start`), _VSCode author_ (preview
and `.c4` editor), _Integrator_ (LSP / RPC).

| ID     | Theme   | Personas                 | Story                                                 |
| ------ | ------- | ------------------------ | ----------------------------------------------------- |
| US-001 | Rename  | Architect, VSCode author | Rename an element's identifier from the canvas        |
| US-002 | Rename  | Architect, VSCode author | Rename a deployment node or a deployed instance       |
| US-003 | Move    | Architect, VSCode author | Move an element to another parent or to the top level |
| US-004 | Safety  | All                      | Refused gestures leave the sources unchanged          |
| US-005 | Undo    | Architect, VSCode author | Undo and redo a rename or a move from the canvas      |
| US-006 | Text F2 | VSCode author            | Rename from the `.c4` editor with F2                  |
| US-007 | Imports | Architect, VSCode author | Projects importing the element follow the rename      |
| US-008 | Agents  | Integrator               | Rename and move through the LSP / RPC                 |

Fixture used below (`model.c4`, plus `views.c4` holding the views):

```likec4
model {
  customer = actor 'Customer' {
    -> cloud.api 'calls'
  }
  cloud = system 'Cloud' {
    api = container 'API' {
      -> db 'reads'
    }
    db = container 'Database'
  }
}
```

### US-001: Rename an element's identifier from the canvas

**As an** architect, **I want** to rename an element's identifier on the canvas, **so that** the
identifier follows the architecture without a manual find-and-replace.

Acceptance criteria:

- AC-1: Given node `cloud.api` selected, when I press F2, then a prompt opens next to the node
  with `api` selected.
- AC-2: Given the toolbar of `cloud.api`, when I click "Rename identifier", then the same prompt
  opens.
- AC-3: When I type `gateway` and press Enter, then `api = container` becomes
  `gateway = container`, `-> cloud.api` becomes `-> cloud.gateway`, every view rule naming
  `cloud.api` names `cloud.gateway`, and nothing else changes in any file.
- AC-4: Given a view with a manual layout showing `cloud.api`, then after the rename the node keeps
  its position and the view reports no drift.
- AC-5: Esc closes the prompt and writes nothing.
- AC-6: Given a reference `this` or `it` inside an `extend cloud.api` block, then it stays as is.

Edge cases:

- EC-1: Same identifier and Enter → no write.
- EC-2: More than one node selected, or none → F2 does nothing.
- EC-3: The element is imported from another project → no rename button; F2 does nothing.
- EC-4: An unnamed instance `instanceOf cloud.api` in a deployment → its references
  (`prod.vm.api`) become `prod.vm.gateway`.
- EC-5: The current view is `view of cloud.api` without a name (its id changes) → the canvas
  shows the same view under its new id, and its snapshot is kept.
- EC-6: Read-only surfaces (static build) → no button, F2 does nothing.

### US-002: Rename a deployment node or a deployed instance

**As an** architect, **I want** to rename deployment nodes and instances, **so that** deployment
views follow the infrastructure's names.

Acceptance criteria:

- AC-1: Given node `prod.vm` in a deployment view, F2 / toolbar rename → `vm = node` becomes
  `server = node` and every reference (`prod.vm.api`, deployment view rules, `extend prod.vm`) is
  rewritten.
- AC-2: Given an unnamed instance `instanceOf cloud.api` shown as `prod.vm.api`, renaming it to
  `apiMain` writes `apiMain = instanceOf cloud.api` and rewrites its references.

Edge cases:

- EC-1: A sibling deployment item already named like the new name → `name-collision`.

### US-003: Move an element to another parent or to the top level

**As an** architect, **I want** to move an element under another parent from the canvas, **so
that** I can reorganise the hierarchy.

Acceptance criteria:

- AC-1: Given node `cloud.db` and the toolbar's "Move to…", then a list opens with "Top level"
  first, then every element of the project except `cloud.db`, its descendants and its current
  parent `cloud`, filtered as I type.
- AC-2: When I pick `customer`, then the `db = container 'Database'` statement (with the comment
  lines directly above it) leaves `cloud`'s block and is appended to `customer`'s block,
  re-indented; `-> db` in `api` becomes `-> customer.db`; view rules naming `cloud.db` name
  `customer.db`.
- AC-3: When I pick "Top level", then the statement goes to the first `model {}` of the file
  defining the current view, and references name `db`.
- AC-4: A reference inside the moved block to an element outside it (for example `-> api` written
  as a short name) is rewritten to its full FQN (`-> cloud.api`).
- AC-5: Given the moved element would no longer be visible in the current view, then
  `include <newFqn>` is appended to the view in the same edit.
- AC-6: Given a manual layout, the node keeps its position. If its new parent is shown in that view,
  the view reports drift as today.

Edge cases:

- EC-1: The new parent has no body → `{ }` is added and the statement goes inside.
- EC-2: The new parent is defined in another file → the statement moves to that file.
- EC-3: The new parent already has a child with the same name → `name-collision`.
- EC-4: Deployment nodes and instances → no "Move to…" button.

### US-004: Refused gestures leave the sources unchanged

**As a** user, **I want** a rename or move that would break the model to be refused, **so that**
I never have to repair the sources by hand.

Acceptance criteria:

- AC-1: An invalid identifier (`1abc`, `a b`) → the prompt shows the error and Enter does nothing;
  sent anyway (integrator) → `invalid-name`.
- AC-2: A rename that would make a reference resolve to another element (for example a sibling
  short name captured by the new name) → `invalid-result` with the reference's `file:line`, and
  every file and snapshot is unchanged.
- AC-3: A move into the element's own subtree or to its current parent → `invalid-parent`.
- AC-4: Every refusal shows a toast with the message (phase-1 failure path).

Edge cases:

- EC-1: The element was renamed in the text meanwhile → `not-found`.

### US-005: Undo and redo a rename or a move from the canvas

**As an** architect, **I want** Ctrl+Z to undo the whole rename or move, **so that** a mistake is
cheap.

Acceptance criteria:

- AC-1: After a rename touching 3 files and 2 snapshots, Ctrl+Z restores all 3 files and both
  snapshots; Ctrl+Shift+Z re-applies them. Works in `likec4 start` and in the VSCode preview.
- AC-2: If one of the files changed since the gesture, Ctrl+Z is refused (`stale-undo`) and
  nothing is restored.

### US-006: Rename from the `.c4` editor with F2

**As a** VSCode author, **I want** F2 in the `.c4` editor to rename an element safely, **so that**
I do not need the canvas for it.

Acceptance criteria:

- AC-1: F2 on `api` (the definition or any reference to it) proposes `api`; entering `gateway`
  applies the same `.c4` edits as US-001 AC-3, in one editor undo step.
- AC-2: F2 on a kind, a tag, a view name, `this` or `it` → "The element can't be renamed."
- AC-3: Snapshots are not rewritten: a view with a manual layout reports drift as today.

### US-007: Projects importing the element follow the rename

**As an** architect with several projects, **I want** imports to follow a rename, **so that**
other projects do not break.

Acceptance criteria:

- AC-1: Given project `b` with `import { cloud } from 'a'` and `-> cloud.api`, renaming `a`'s
  `cloud` to `platform` rewrites the import to `import { platform } from 'a'` and the reference
  to `-> platform.api`.

Edge cases:

- EC-1: Moving an imported top-level element under a parent → `has-references` listing the
  importing files.

### US-008: Rename and move through the LSP / RPC

**As an** integrator, **I want** the same ops on the programmatic surfaces, **so that** agents can
reorganise a model safely.

Acceptance criteria:

- AC-1: `likec4/change-view` and `updateView` accept `rename-element` and `move-element` with
  the payloads in `_dx.md` and return the same codes as the canvas.
- AC-2: When the current view's id changed, the success result carries the new `viewId`.
