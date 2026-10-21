# Test Specification: Visual-to-code editing (phase 1)

This is the canonical test contract for canvas → DSL editing. It is a companion to `_spec.md`, and
is derived from `_user_stories.md`, `_spec.md` Part II, `_dx.md` and `_uiux.md`.

## Strategy

- **Frameworks**: Vitest everywhere. Playwright (`e2e/`) for browser journeys against
  `likec4 start`.
- **Language-server unit cases** use the `changeElementStyle.spec.ts` harness: memfs
  (`vi.mock('node:fs')`), `createTestServices` + `WithFileSystem()`, and `stripIndent` fixtures.
  Each case asserts the _full_ resulting file text with an inline snapshot ("DSL before → op → DSL
  after").
- **Integration cases** run `LikeC4ModelChanges.applyChange` end-to-end. Without an LSP connection,
  the FS branch is exercised. With one, `Connection.workspace.applyEdit` is a fake recording the
  `WorkspaceEdit` and returning `{ applied: true | false }`.
- **Editor-actor cases** extend `packages/diagram/src/editor/actor/state.sync-queue.spec.ts` with a
  fake port (`handleChange` resolving or rejecting).
- **Execution**: `pnpm test --no-typecheck` for unit/integration; `pnpm test:e2e` for E2E.
- **Conventions**: `*.spec.ts` next to the source; table-driven `it.each` for the anchoring
  variants.

## Coverage Matrix

| Source                        | Behavior                                                          | Unit                                                                                    | Integration | E2E                                    |
| ----------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------- | -------------------------------------- |
| US-001 AC-1, AC-5             | relation written inside source block, rest untouched              | UT-010                                                                                  | IT-001      | E2E-001                                |
| US-001 AC-2                   | VSCode: one WorkspaceEdit                                         | —                                                                                       | IT-002      | manual (VSCode)                        |
| US-001 AC-3/AC-4              | auto-include only when needed                                     | UT-030, UT-031                                                                          | IT-003      | —                                      |
| US-001 EC-1                   | source in other project → view's model{}                          | UT-011                                                                                  | —           | —                                      |
| US-001 EC-2/3/4               | no body, `}` same line, tabs                                      | UT-001–UT-004                                                                           | —           | —                                      |
| US-001 EC-5                   | self / empty drop → no op                                         | UT-060                                                                                  | —           | —                                      |
| US-001 EC-6                   | duplicate relation allowed                                        | UT-012                                                                                  | —           | —                                      |
| US-001 EC-7                   | stale target → not-found                                          | UT-040                                                                                  | —           | —                                      |
| US-001 EC-8                   | invalid result reverted                                           | —                                                                                       | IT-004      | —                                      |
| US-001 EC-9                   | applyEdit refused → apply-failed                                  | —                                                                                       | IT-005      | —                                      |
| US-001 EC-10                  | two connects in order                                             | UT-061                                                                                  | IT-008      | —                                      |
| US-001 EC-11 / US-002 AC-5    | manual snapshot updated, no drift                                 | UT-062                                                                                  | —           | E2E-002                                |
| US-002 AC-1, EC-1             | palette lists spec kinds / empty                                  | UT-070, UT-071                                                                          | —           | —                                      |
| US-002 AC-2, AC-3, EC-7, EC-8 | element placement rules                                           | UT-013–UT-016                                                                           | —           | E2E-002                                |
| US-002 AC-6                   | no snapshot → auto layout                                         | covered by IT-003 (no snapshot written)                                                 | —           | —                                      |
| US-002 AC-7, EC-3             | cancel / empty title                                              | UT-072                                                                                  | —           | —                                      |
| US-002 EC-2, EC-5             | slug + collision suffix + fallback                                | UT-020–UT-023                                                                           | —           | —                                      |
| US-002 EC-4                   | quote escaping                                                    | UT-024                                                                                  | —           | —                                      |
| US-002 EC-6                   | read-only parent                                                  | UT-041                                                                                  | —           | —                                      |
| US-002 EC-9, US-011 EC-1/2    | unknown-kind, invalid-name, name-collision                        | UT-042–UT-044                                                                           | —           | —                                      |
| US-003                        | retitle variants                                                  | UT-100–UT-105                                                                           | —           | —                                      |
| US-004                        | exclude nodes/edges/multi/deployment                              | UT-110–UT-113                                                                           | IT-006      | E2E-003                                |
| US-004 EC-2                   | no Del on nodes in dynamic views (superseded for steps by US-016) | UT-063                                                                                  | —           | —                                      |
| US-005 AC-1/2, EC-3           | reference listing blocks delete                                   | UT-073, UT-120                                                                          | —           | —                                      |
| US-005 AC-3/4                 | remove element / relation statement                               | UT-121, UT-122                                                                          | —           | —                                      |
| US-005 EC-1, EC-4             | menu absent                                                       | UT-074                                                                                  | —           | —                                      |
| US-005 EC-2                   | server-side has-references                                        | UT-123                                                                                  | —           | —                                      |
| US-006                        | dev-server undo/redo                                              | UT-130–UT-133                                                                           | IT-007      | E2E-004                                |
| US-006 EC-4 / US-018          | undo over an LSP connection (ADR-004; replaces "unsupported")     | UT-134                                                                                  | IT-009      | manual (VSCode)                        |
| US-007                        | deployment node placement                                         | UT-140–UT-142                                                                           | —           | —                                      |
| US-008                        | instanceOf                                                        | UT-143–UT-145                                                                           | —           | —                                      |
| US-009                        | dynamic step append                                               | UT-150–UT-152                                                                           | —           | —                                      |
| US-010                        | read-only: no affordances                                         | UT-064                                                                                  | —           | existing `e2e` static smoke + E2E-005  |
| US-011 AC-2                   | error code shape                                                  | UT-045                                                                                  | IT-010      | —                                      |
| US-011 AC-3                   | serialised per project                                            | —                                                                                       | IT-008      | —                                      |
| Ghost lifecycle (S2)          | pending → confirmed / rejected                                    | UT-065, UT-066                                                                          | —           | E2E-001                                |
| US-012                        | identifier suggestion, follow/override, validation                | UT-200–UT-206                                                                           | —           | E2E-006                                |
| US-013                        | kind + technology on connect                                      | UT-210–UT-214                                                                           | —           | E2E-007                                |
| US-014                        | relation retitle                                                  | UT-220–UT-225                                                                           | —           | —                                      |
| US-015                        | step position                                                     | UT-230–UT-233                                                                           | —           | —                                      |
| US-016                        | step removal                                                      | UT-240–UT-245                                                                           | —           | E2E-008                                |
| US-017                        | manual-layout notice                                              | UT-250–UT-252                                                                           | —           | —                                      |
| US-018 AC-3                   | canvas undo keeps the snapshot in sync                            | UT-260                                                                                  | —           | E2E-009 (dev server); manual (VSCode)  |
| Existing ops unchanged        | change-element-style, autolayout, property, snapshot              | existing `changeElementStyle.spec.ts`, `viewChange.spec.ts`, `state.sync-queue.spec.ts` | —           | existing `manual-layout-views.spec.ts` |

## Unit Tests

### CST anchors — `model-change/_anchors.ts` (Spec: Implementation Design)

- **UT-001** (happy): insert a child into `a = system 'A' {\n  b = service\n}`, appended after `b`
  with 2-space indent + parent indent.
- **UT-002** (boundary): a parent with no body, `a = system 'A'` → `a = system 'A' {\n  <child>\n}`.
- **UT-003** (boundary): `a = system 'A' { b = service }` (single line) → the child is inserted on
  its own line before `}`, and the result parses with no errors.
- **UT-004** (boundary): a tab-indented file → the inserted line uses tabs. A CRLF file keeps CRLF.
- **UT-005** (boundary): the file has no `model {}` → `\nmodel {\n  <child>\n}\n` is appended at
  EOF.
- **UT-006** (happy): append to the end of a view body; the view body ends with `}` on the same line
  as the last rule.

### add-relation — `model-change/addRelation.ts`

- **UT-010** (happy): the source `customer` has a body with a description and a comment →
  `-> cloud` is appended as the last line of the body; the comment stays.
- **UT-011** (happy): the source is defined in an imported project → `customer -> cloud` is written
  in the `model {}` of the view's file.
- **UT-012** (happy): an existing `customer -> cloud` → a second statement is written.

### add-element — `model-change/addElement.ts`

- **UT-013** (happy): parent `cloud` (defined in `model.c4`), kind `service`, title `Billing API` →
  `billingApi = service 'Billing API'` is the last child of `cloud`'s block in `model.c4`.
- **UT-014** (happy): parent null, view `index` in `views.c4` which has a `model {}` → the element is
  written as the last entry of that `model {}`.
- **UT-015** (boundary): parent null, and the view's file has no `model {}` → `model {` … `}` is
  appended at EOF containing the element, and the file parses.
- **UT-016** (state): `cloud` is defined in `model.c4` and `extend cloud { }` exists in `views.c4` →
  the element is written in `model.c4`, and `views.c4` is unchanged.

### Identifier derivation — `model-change/_naming.ts`

- **UT-020** (happy): `'Billing API'` → `billingApi`.
- **UT-021** (boundary): `'Ação & Cia 2'` → `acaoCia2` (diacritics stripped, non-alphanumerics
  dropped).
- **UT-022** (state): siblings `billingApi`, `billingApi2` exist → `billingApi3`.
- **UT-023** (boundary): `'???'` with kind `service` → `service`; if taken → `service2`.
- **UT-024** (happy): title `It's` → written as `'It\'s'`, and the file parses.

### Visibility prediction — `model-change/_visibility.ts`

- **UT-030** (happy): the view `include cloud` and a new relation `customer -> cloud` → predicted
  not visible → the plan contains `include customer -> cloud` in the view body.
- **UT-031** (happy): the view `include *` → predicted visible → no include edit.

### Preconditions — `ModelChanges` validation

- **UT-040** (error): add-relation with target `cloud.ui` missing → `{ success:false,
  code:'not-found', error:'Element "cloud.ui" not found' }`, and the file is unchanged.
- **UT-041** (error): add-element with a parent from another project → `read-only-target`.
- **UT-042** (error): add-element with kind `servise` → `unknown-kind`.
- **UT-043** (error): add-element with name `billing api` → `invalid-name`.
- **UT-044** (error): add-element with explicit name `billingApi` when it exists →
  `name-collision`.
- **UT-045** (error): add-dynamic-step on an element view → `unsupported-in-view`.

### Editor actor + canvas wiring (packages/diagram)

- **UT-060** (error): `onConnect` with source === target, or a missing target → no `change.view`
  is raised.
- **UT-061** (ordering): two `change.view` add-relation events → `handleChange` is called twice, in
  order, and neither is deduped by `pushToSyncQueue`.
- **UT-062** (state): after the add-element sync with a manual snapshot present → a
  `save-view-snapshot` is queued with the new node's position equal to the ghost's drop position.
- **UT-063** (state): `onDelete` in a dynamic view → no event.
- **UT-064** (state): `enableReadOnly` or stub port → nodes not connectable, palette/title
  editor/context menu not rendered.
- **UT-065** (state): add-relation queued → a ghost exists; `view.synched` → the ghost is removed.
- **UT-066** (error): the port rejects → the ghost is removed and a notification is shown with the
  error message.

### Editor UI (packages/diagram/src/editor-ui)

- **UT-070** (happy): the palette for a model with kinds `actor, system, service` renders three
  items in that order.
- **UT-071** (boundary): no kinds → `No element kinds in specification`.
- **UT-072** (state): DropPopover with empty title → Confirm disabled; Esc → no `change.view`.
- **UT-073** (state): the DeleteFromModelDialog for an element with one incoming relation and one
  view rule → lists 2 references, no Delete button, text `Remove these references first`.
- **UT-074** (state): the context menu for an edge with 2 relations, or an element from another
  project → no "Delete from model".

### change-title — `model-change/changeTitle.ts`

- **UT-100** (happy): `api = service 'API'` → `api = service 'Public API'`.
- **UT-101** (happy): `title 'API'` property → value replaced, positional strings untouched.
- **UT-102** (happy): no title → `api = service 'Public API'` inserted after the kind.
- **UT-103** (idempotency): same title → no edits, `{ success:false, error:'No changes to apply' }`
  (existing behaviour).
- **UT-104** (happy): a deployment node title replaced.
- **UT-105** (happy): `instanceOf cloud.api 'Old'` → the instance title replaced.

### exclude-from-view — `model-change/excludeFromView.ts`

- **UT-110** (happy): node `cloud.db` → `exclude cloud.db` appended as the last rule of the view.
- **UT-111** (happy): edge → `exclude cloud.api -> cloud.db`.
- **UT-112** (happy): 3 targets → 3 lines in one edit, in order.
- **UT-113** (happy): a deployment view → `exclude prod.eu.worker`.

### delete-from-model — `model-change/deleteFromModel.ts`

- **UT-120** (error): an element with an incoming relation in another file → `has-references`,
  error `Element "cloud.legacy" is referenced in 1 place`.
- **UT-121** (happy): an unreferenced element with a body and a leading comment → the block lines
  are removed; the comment above stays, and no blank-line pile-up (at most one blank line remains).
- **UT-122** (happy): a relation statement inside a source block → that line is removed.
- **UT-123** (concurrency): a reference added after the client check → the server returns
  `has-references`.

### Undo stack — `model-change/UndoStack.ts`

- **UT-130** (happy): apply add-relation, then undo → the file text equals the original.
- **UT-131** (happy): undo, then redo → the file text equals the post-apply text.
- **UT-132** (state): the file edited externally after the apply → undo returns `stale-undo` and
  the stack is cleared.
- **UT-133** (boundary): 101 applies → the 1st is no longer undoable; undo on empty → `not-found`,
  `Nothing to undo`.

### Deployment — `addDeploymentNode.ts`, `addInstance.ts`

- **UT-140** (happy): parent `prod.eu`, kind `vm`, title `Worker` → `worker = vm 'Worker'` inside
  `eu`.
- **UT-141** (boundary): parent null and no `deployment {}` in the view's file → a block is
  appended.
- **UT-142** (error): unknown deployment kind → `unknown-kind`.
- **UT-143** (happy): `instanceOf cloud.api` inside `worker`.
- **UT-144** (state): a second instance of the same element → `api2 = instanceOf cloud.api`.
- **UT-145** (error): element missing → `not-found`.

### Dynamic — `addDynamicStep.ts`

- **UT-150** (happy): `web -> api` appended after the last top-level step.
- **UT-151** (boundary): the last statement is a `parallel { … }` block → the step goes after the
  block, at top level.
- **UT-152** (boundary): a view with no steps → the step is inserted before the first rule (or
  before `}` if no rules).

### Amendment of 2026-10-18 (US-012 – US-018)

#### Identifier — `@likec4/core/utils` `identifier.ts`, drop popover (US-012)

- **UT-200** (happy): the existing `_naming.spec.ts` cases pass unchanged against the core module.
- **UT-201** (happy): the popover prefills `newSystem` for kind `system`, and typing the title
  `Payment Service` updates it to `paymentService`.
- **UT-202** (state): after the user edits the identifier, title changes do not update it; clearing
  it resumes following.
- **UT-203** (happy): focusing the identifier selects all its text.
- **UT-204** (error): `9lives` → `Invalid identifier`, confirm disabled; a sibling's name →
  `Already used by a sibling`, confirm disabled.
- **UT-205** (happy): Enter sends `add-element` with `name` set to the field's value.
- **UT-206** (happy): instance popover suggests the element name, `api2` when `api` is taken.

#### add-relation kind/technology — `addRelation.ts`, connect popover (US-013)

- **UT-210** (happy): `kind: 'async'` → `-[async]-> cloud.queue`.
- **UT-211** (happy): `technology: 'Kafka'` → a body with `technology 'Kafka'`; with a title →
  `-> cloud.queue 'publishes' {` / `technology 'Kafka'` / `}`.
- **UT-212** (error): undeclared kind → `unknown-kind`, no write.
- **UT-213** (happy): the popover lists `none` + the declared relationship kinds, and has no kind
  field when none are declared.
- **UT-214** (happy): Enter with empty fields sends `add-relation` without `title`, `kind`,
  `technology`; Esc sends nothing and removes the ghost.

#### Relation retitle — `changeTitle.ts`, edge label editor (US-014)

- **UT-220** (happy): positional title replaced.
- **UT-221** (happy): relation without title → the title is inserted after the target reference
  (also when tags or a body follow).
- **UT-222** (happy): `title` property in the body is updated.
- **UT-223** (happy): empty title → the literal or property is removed.
- **UT-224** (error): relation id unknown to the project → `not-found`, nothing written (relations of other
  projects are not imported, so no edge can target one).
- **UT-225** (happy): double-click on the label of an edge with one relation opens the editor;
  with several relations it does not.

#### Dynamic steps — `addDynamicStep.ts`, `removeDynamicStep.ts` (US-015, US-016)

- **UT-230** (happy): `beforeStep: 'step-02'` → the step is inserted on its own line before that
  step's top-level statement, with its indentation; for a step inside a block, before the block.
- **UT-231** (boundary): unknown `beforeStep` → appended at the end.
- **UT-232** (happy): the connect popover lists `At the end` + one entry per top-level step.
- **UT-233** (boundary): no steps → no position field.
- **UT-240** (happy): `step-02` (a single top-level step) → its line is removed.
- **UT-241** (happy): a step inside `par { … }` → only its line is removed, the block stays.
- **UT-242** (happy): a step in an `alt` branch and in a `try`/`catch` block → removed.
- **UT-243** (error): a step of a chain → `unsupported-in-view` with the chain message.
- **UT-244** (error): unknown step path → `not-found`.
- **UT-245** (happy): `Del` on a selected step edge in a dynamic view sends `remove-dynamic-step`;
  on a node it sends nothing.

#### Manual-layout notice (US-017)

- **UT-250** (happy): palette in a view with a snapshot shows the notice; with auto layout it does
  not.
- **UT-251** (happy): the first drop in a manual view shows the info toast; the second does not.
- **UT-252** (boundary): read-only → no notice.

#### Undo with an LSP connection (US-018, ADR-004)

- **UT-134** (happy): with the faked connection, apply → undo → redo: each step sends one
  `applyEdit`, returns `modifiedUris`, and the file texts match before/after.
- **UT-260** (state): editor actor, manual-layout view: undo of a model entry is followed by a
  snapshot refresh (the node is removed from the snapshot) in the same Ctrl+Z.

## Integration Tests

### ModelChanges.applyChange end-to-end

- **IT-001**: FS branch — the fixture has `model.c4` (elements) and `views.c4` (view `index` with
  `include *`); apply add-relation `customer → cloud` → `model.c4` changes by exactly the inserted
  line, `views.c4` is byte-identical, and `computeModel` has the relation with no new diagnostics.
- **IT-002**: LSP branch — the fake connection records exactly **one** `applyEdit` whose
  `WorkspaceEdit.changes` has 2 URIs (model file + view file with `include`) for a view `include
  customer`.
- **IT-003**: auto-include round trip — after IT-002's edit, recompute → the view contains the
  relation edge.
- **IT-004**: guard — make add-relation produce a linking error (inject a parent-child relation the
  validator rejects) → the final file text equals the original, the response code is
  `invalid-result`, and the message contains the diagnostic.
- **IT-005**: LSP `applyEdit` returns `{ applied:false, failureReason:'read-only' }` → `apply-failed`
  and the message includes `read-only`.
- **IT-006**: exclude round trip — exclude `cloud.db` from `index` → the recomputed view has no node
  `cloud.db`; the model elements count is unchanged.
- **IT-007**: undo through the vite RPC function `undoChange` against a real `LikeC4` instance
  (`fromWorkspace` on a temp dir) → the file is restored and `updateView` → `undoChange` →
  `redoChange` round-trips.
- **IT-008**: concurrency — fire two `applyChange` calls without awaiting → the second starts after
  the first resolves (invariant 2), and both relations are present.
- **IT-009**: `likec4/undo-change` with an LSP connection → one `WorkspaceEdit` restoring the
  texts, `success: true`, `modifiedUris` set (ADR-004; replaces the former `unsupported-in-view`
  case).
- **IT-010**: vite `updateView` with a rejected op throws `Error` whose message starts with
  `[not-found]`.

## End-to-End Tests

All run against `likec4 start` on fixture `e2e/fixtures/visual-to-code/` (the `_dx.md` golden-path
project), with the fixture restored before each test.

- **E2E-001** (US-001): open `index` → drag from the `customer` handle to `cloud` → a dashed edge is
  visible → a solid edge is visible → `model.c4` contains `-> cloud` inside `customer`.
- **E2E-002** (US-002, D12): a view with a saved manual layout → drag `system` from the palette to
  (400, 300) → enter `Billing` → Enter → node `Billing` at ≈(400, 300) ± 20 px, no drift badge,
  `model.c4` contains `billing = system 'Billing'`.
- **E2E-003** (US-004): select `cloud` → `Del` → the node is gone → the view file contains
  `exclude cloud`.
- **E2E-004** (US-006): connect, then Ctrl+Z → the edge is gone and `model.c4` equals the fixture;
  Ctrl+Shift+Z → the edge is back.
- **E2E-005** (US-010): `likec4 build` of the fixture, served statically → no `.react-flow__handle`
  in edit mode, no palette, and `Del` leaves the DOM unchanged.

- **E2E-006** (US-012): drop `system` → type title `Payment Service` → Tab to the identifier →
  type `payments` → Enter → `model.c4` contains `payments = system 'Payment Service'`.
- **E2E-007** (US-013): connect `customer` → `cloud`, choose a kind and type a technology → Enter →
  `model.c4` contains `-[<kind>]-> cloud` with `technology '<value>'`.
- **E2E-008** (US-016): open the dynamic fixture view → select step 1's edge → `Del` → the step's
  line is gone from `dynamic.c4`.
- **E2E-009** (US-018 AC-3, dev server): manual-layout view → drop a new element → Ctrl+Z → the
  element is gone from `model.c4`, the snapshot has no node for it, and no drift badge is shown.

VSCode (US-001 AC-2, US-018): a manual verification checklist in the slice-1 task, using the
`vscode-extension-screenshot-evidence` skill for evidence.
