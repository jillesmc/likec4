---
title: 'Visual-to-code editing, phase 2: rename identifiers and move elements'
slug: visual-to-code-rename-move
status: draft
created: 2026-10-20
source: docs/requirements/visual-to-code/epic.md (D7, D8, §5 Phase 2); owner answers Q1–Q7 of 2026-10-20
baseline: feat/visual-to-code @ e8b6894fe (phase 1 delivered)
predecessor: visual-to-code (phase 1)
---

# Part I — Product

## Overview

- **Motivating Problem**: renaming an element's identifier or moving an element to another parent
  means hunting every reference by hand: relations, view predicates, `extend` blocks, `instanceOf`,
  dynamic steps, imports from other projects. A missed reference breaks the model, and a renamed or
  moved element loses its place in every manual layout. The `.c4` editor offers no help: the
  rename provider exists but is disabled because it is not FQN-aware. The simplest end-to-end
  behaviour that removes this pain is: **press F2 on a node, type a new identifier, and every
  reference in the workspace is rewritten in one minimal edit, with the manual layouts keeping the
  node where it was.**
- **Who it is for**: the phase-1 personas: architects in `likec4 start`, VSCode authors in the
  preview, and integrators calling the LSP/RPC.
- **Why it is valuable**: identifiers and hierarchy can follow the architecture as it evolves,
  without a risky manual find-and-replace, and the change stays a reviewable diff.

## Goals

- Users can rename the identifier of an element, a deployment node or a deployed instance from the
  canvas (F2 or the node toolbar).
- Users can move an element, with its whole subtree, to another parent or to the top level from
  the canvas (node toolbar, "Move to…").
- Every reference to the renamed or moved items is rewritten in the same gesture, across files and
  across projects that import them. Everything else stays byte-identical.
- A gesture that would leave a reference broken or pointing to another element is refused, and the
  sources stay unchanged.
- Manual-layout snapshots follow the rename or move: no node is reported as removed and re-added.
- One canvas Ctrl+Z undoes the whole gesture (all files and snapshots), in both hosts.
- F2 in the `.c4` editor renames elements, deployment nodes and instances with the same reference
  rewrite.

## User Stories

- US-001: rename an element from the canvas
- US-002: rename a deployment node or a deployed instance
- US-003: move an element to another parent or to the top level
- US-004: refused gestures leave the sources unchanged
- US-005: undo and redo of rename and move
- US-006: F2 in the `.c4` editor
- US-007: projects that import the element
- US-008: programmatic use (integrator)

Details are in [`_user_stories.md`](_user_stories.md).

## Core Features

1. **Rename identifier**: F2 with exactly one node selected, or the "Rename identifier" button of
   the node toolbar, opens a prompt with the current identifier selected. Enter renames, Esc
   cancels.
2. **Move to…**: the node toolbar's "Move to…" button opens a searchable list of possible parents,
   with "Top level" first. Choosing one moves the element.
3. **Reference rewrite**: every reference to the renamed or moved items is rewritten (rules 3, 6).
4. **Snapshot follow-up**: manual-layout snapshots of every view of the project are rewritten in the
   same gesture (rule 9).
5. **Text rename**: the language server answers `textDocument/prepareRename` and
   `textDocument/rename` for elements, deployment nodes and instances (rule 12).

Ghost feedback, failure toasts, the validity guard, staleness re-validation, read-only surfaces and
canvas undo are inherited from phase 1 (its rules 1, 2, 11–15).

## Business Rules

1. **Phase-1 rules stay binding**: `.c4` files are the source of truth, edits are minimal
   `TextEdit`s, preconditions are re-validated at apply time, no git interaction, no affordance on
   read-only surfaces.
2. **What can be renamed (Q4, owner 2026-10-20)**: elements, deployment nodes and deployed
   instances defined in the current project. Kinds, tags, views and other symbols are not renamed
   by this feature. Items defined in another project are read-only (`read-only-target`); the
   rename button is absent for them.
3. **Rename rewrite**: the definition's name and every reference segment that resolves to the item
   and spells its old name are replaced with the new name. `this` and `it` are never rewritten.
   References are found through the language server's reference index, in every project of the
   workspace.
   - An unnamed instance (`instanceOf cloud.api`) takes its name from the element. Renaming the
     element renames such instances too, and their references are rewritten.
   - Renaming an unnamed instance itself inserts the name (`newName = instanceOf cloud.api`).
4. **Identifier rules**: the new name must match the grammar's `Id` (`invalid-name`) and must not
   be taken by a sibling (`name-collision`). The same name is a no-op (no write). The prompt
   validates both client-side, as the phase-1 identifier prompt does.
5. **What can be moved (Q4)**: elements of the current project, with their subtree. Deployment
   nodes and instances cannot be moved. The new parent is another element of the same project, or
   the top level. A parent inside the moved subtree, or the current parent, is refused
   (`invalid-parent`); a sibling with the same name in the new parent is refused
   (`name-collision`).
6. **Move rewrite (Q6, owner 2026-10-20)**:
   - The element's definition (its statement, plus the comment lines directly above it) is cut from
     its file and inserted at the end of the new parent's block, in the file holding the parent's
     definition, re-indented (phase-1 placement rule D4). A parent without a body gets `{ }`. For
     the top level, the target is the first `model {}` of the file defining the current view.
   - Each reference outside the moved block that targets the moved element or one of its
     descendants is rewritten to the target's full new FQN.
   - Each reference inside the moved block that targets an element outside the moved subtree is
     rewritten to that element's full FQN, so it still resolves from the new place.
   - Other references are left untouched.
7. **Visibility after a move**: if the moved element would no longer be visible in the current view,
   `include <newFqn>` is appended to the view in the same edit (phase-1 rule D5 prediction).
8. **Resolution guard (ADR-001)**: after applying a rename or move, the gesture is reverted and
   refused with `invalid-result` when any touched document gains errors (phase-1 rule 11), or when
   any reference of the affected projects now resolves to a different element than before (for
   example a short name captured by the renamed element). The message names the first offending
   reference (`file:line`).
9. **Snapshots (ADR-002)**: in every manual-layout snapshot of the affected projects, node ids and
   the ids they refer to (parent, children, model and deployment references, edge sources and
   targets) are mapped from the old FQNs to the new ones. A view whose id changes (an unnamed
   `view of x` after renaming `x`) gets its snapshot moved to the new id.
   - A rename reports no drift.
   - A move keeps the node's position. If the move changes the node's parent in a view (the new
     parent is shown there), that view reports drift as today.
10. **Current view id**: when the gesture changes the id of the current view, the canvas switches to
    the new id.
11. **Undo (phase-1 rule 14, ADR-002)**: a rename or move is one history entry with all its files
    and snapshots. Canvas Ctrl+Z restores all of them, Ctrl+Shift+Z re-applies all of them. The
    `stale-undo` check covers every file of the entry.
12. **Text rename (Q3, owner 2026-10-20; ADR-003)**: F2 in the `.c4` editor on the name or on a
    reference of an element, deployment node or instance proposes a rename. It produces the same
    `.c4` edits as rule 3 as one `WorkspaceEdit`, applied by the editor (native undo). It does not
    run the resolution guard and does not rewrite snapshots: a broken result shows as diagnostics,
    and snapshot drift is reported as today. On any other symbol, F2 answers "cannot rename".
13. **Cross-project imports (Q5, owner 2026-10-20)**: an `import { x } from 'p'` of a renamed element
    is rewritten, together with the importing project's references to `x`. Moving an imported
    (top-level) element under a parent breaks its import (only top-level elements can be
    imported), so such a move is refused with `has-references` listing the importing files.

## User Experience

- **Rename flow**: select a node → F2 (or the toolbar's "Rename identifier") → the prompt shows the
  identifier, selected → type → Enter → the node keeps its place; the `.c4` files show the new
  name everywhere.
- **Move flow**: select a node → toolbar "Move to…" → type to filter the parents → pick one → the
  node shows under its new parent (or stays put if the parent is not in the view); the definition
  sits in the new parent's block.
- Surface-by-surface states are in [`_uiux.md`](_uiux.md).
- Accessibility: both prompts are keyboard-only operable (Tab, arrows, Enter, Esc).

## High-Level Technical Constraints

- Same seam as phase 1: `ViewChange` → `likec4/change-view` (LSP) or `updateView` (vite RPC) →
  `LikeC4ModelChanges`.
- Repository layering rules (AGENTS.md) are binding.
- Internal fork: keep changes additive; new logic in new files.
- Feedback target: rename of an element with 50 references across 10 files completes in under 2 s
  on a 1k-element workspace (perception, not a CI gate).

## Non-Goals (Out of Scope)

- Moving deployment nodes or instances; moving relations.
- Renaming kinds, tags, views, relationship kinds or any `specification {}` symbol.
- Drag-and-drop into a container as a model move (Q2: an explicit action only). Dragging stays
  layout-only.
- A canvas right-click menu (the toolbar hosts the actions).
- Snapshot rewrite and the resolution guard for the `.c4` editor's F2 (rule 12).
- Moving an element to another project.
- Shortening references after a move (rewritten references use full FQNs).

## Resolved Questions

Answered by the owner on 2026-10-20:

- **Q1 — rename gesture**: F2 on the selected node plus a toolbar button, opening the identifier
  prompt → feature 1, US-001.
- **Q2 — move gesture**: an explicit "Move to…" list → feature 2, US-003.
- **Q3 — text F2**: enabled with the same reference rewrite → rule 12, US-006.
- **Q4 — scope**: rename of elements, deployment nodes and instances; move of elements only →
  rules 2, 5.
- **Q5 — importing projects**: rewritten too → rule 13, US-007.
- **Q6 — move placement**: into the new parent's block, in its file, with the comments above →
  rule 6.
- **Q7 — where the actions live**: in the node toolbar, next to "Delete from model" (no new
  context menu) → `_uiux.md`.

## Open Questions

None.

---

# Part II — Technical

## Executive Summary

Two new `ViewChange` ops, `rename-element` and `move-element`, get handlers in
`packages/language-server/src/model-change/`. Both build on a new **reference planner**
(`model-change/_references.ts`) that lists, through Langium's `References.findReferences`, every
reference segment to a set of AST nodes across the workspace and plans the text edits (ADR-001).
`LikeC4ModelChanges.applyChange` gains a resolution guard (a snapshot of resolved references taken
before the apply and compared after it), a snapshot rewrite through `LikeC4ManualLayouts`, and
history entries that carry snapshots (ADR-002). `LikeC4RenameProvider` is re-enabled on the same
planner for text F2 (ADR-003). The diagram adds F2, two toolbar buttons and two prompts in
`editor-ui/`. Hosts forward the ops unchanged; the success result gains the current view's new id.

## MVP Boundary

The MVP is slices 1–2: canvas rename of elements, in both hosts, with reference rewrite, guard,
snapshots and undo. It solves the Motivating Problem's rename half on its own. Move (slices 5–6)
solves the other half. Deployment rename (3), imports (4) and text F2 (7) follow.

## Developer Experience

- [Developer experience contract](_dx.md): the two ops, the new error code, the result's `viewId`,
  and the LSP rename requests.
- [UI change map](_uiux.md): F2, toolbar buttons, the rename prompt and the move list.

## System Architecture

```
packages/diagram
  F2 / toolbar "Rename identifier" → RenamePrompt → change.view { rename-element }
  toolbar "Move to…"               → MovePrompt   → change.view { move-element }
  → sync queue → port.handleChange → result.viewId? → onNavigateTo(viewId)
hosts: forward (SPA updateView, VSCode ExtensionApi.change) and pass back the result's viewId
packages/language-server  LikeC4ModelChanges.applyChange
  1. handler (renameElement.ts / moveElement.ts) → _references.ts plan:
       { edits: Map<uri, TextEdit[]>, fqnMap: Map<oldFqn, newFqn> }
  2. preconditions (name, collision, parent, editability)
  3. visibility prediction (move only, phase-1 machinery)
  4. guard baseline: resolved references of the affected projects
  5. applyWorkspaceEdits → rebuild → guard: new errors or changed resolution → revert → invalid-result
  6. snapshots: rewrite through LikeC4ManualLayouts (fqnMap, view id map)
  7. history entry { files, snapshots }
LikeC4RenameProvider (text F2) → same planner, edits only, as WorkspaceEdit
```

## Architectural Boundaries

- `packages/core`: the two `ViewChange` members, the error code, and a pure
  `renameFqnsInSnapshot(view, fqnMap)` in `core/src/manual-layout/` (no new dependency).
- `packages/language-server/src/model-change/`: `_references.ts` (planner), `renameElement.ts`,
  `moveElement.ts`, `_guard.ts` (resolution baseline). `lsp/RenameProvider.ts` uses the planner.
- `packages/diagram`: prompts and buttons in `editor-ui/`; F2 in the editor actor's hotkey; no
  `likec4:*` imports.
- Hosts: forward only, plus passing the result's `viewId` back.

## Implementation Design

### Core Interfaces

`packages/core/src/types/view-changes.ts` (additive):

```ts
export namespace ViewChange {
  /** Rename the identifier of an element, deployment node or deployed instance (rules 2–4) */
  export interface RenameElement {
    op: 'rename-element'
    target: { element: scalar.Fqn } | { deployment: scalar.DeploymentFqn }
    name: string
  }

  /** Move an element with its subtree under another parent, or to the top level (rules 5–7) */
  export interface MoveElement {
    op: 'move-element'
    element: scalar.Fqn
    parent: scalar.Fqn | null
  }
}

export type ViewChangeErrorCode =
  | /* phase-1 codes */ 'not-found'
  | 'invalid-name'
  | 'name-collision'
  | 'unknown-kind'
  | 'read-only-target'
  | 'has-references'
  | 'unsupported-in-view'
  | 'invalid-result'
  | 'apply-failed'
  | 'stale-undo'
  | 'invalid-parent' // new
```

`packages/language-server/src/protocol.ts`: the `ChangeView.Res` success branch gains
`viewId?: ViewId` — the current view's id after the change, present only when it changed (rule 10).

`LikeC4EditorCallbacks.handleChange` may resolve with `{ viewId?: ViewId } | void` (additive).

Reference planner (`model-change/_references.ts`):

```ts
export interface ReferencePlan {
  edits: Map<string, /* uri */ TextEdit[]>
  /** Old → new FQN of every element / deployment item whose FQN changes */
  fqnMap: Map<string, string>
  /** Old → new id of every view whose id changes (unnamed `view of x`) */
  viewIdMap: Map<string, string>
}
export function planRename(services: LikeC4Services, node: RenameableNode, name: string): ReferencePlan
export function planMove(
  services: LikeC4Services,
  element: ast.Element,
  parent: ast.Element | null,
  viewFile: URI,
): ReferencePlan
```

Resolution guard (`model-change/_guard.ts`): `resolvedReferences(projects)` returns the multiset of
`(document uri, resolved target FQN)` pairs of every cross-reference to an element or deployment
item; the guard maps the baseline through `fqnMap` (and through the moved block's new uri) and
compares it with the result after the rebuild.

### Data Models

- History entry (`ModelChanges.ts`) gains
  `snapshots?: Array<{ projectId; viewId; before: LayoutedView | null; after: LayoutedView | null }>`
  (ADR-002). Undo writes `before` (deleting the file when `null`), redo writes `after`.
- Snapshot files: format unchanged.

### API Endpoints

- LSP `likec4/change-view`, vite RPC `updateView`: accept the two ops; success may carry
  `viewId`.
- LSP `textDocument/prepareRename`, `textDocument/rename`: enabled (rule 12).

## Integration Points

None outside the repository.

## Impact Analysis

| Component                                              | Impact Type          | Description and Risk                                                                                   | Required Action                       |
| ------------------------------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| `core/types/view-changes.ts`                           | modified (additive)  | 2 ops, 1 error code. Exhaustive switches break at compile time (desired). Low                          | `pnpm exec tsc --build`               |
| `core/manual-layout/` `renameFqnsInSnapshot`           | new                  | Pure id mapping. Low                                                                                   | Unit spec                             |
| `language-server/model-change/_references.ts`          | new                  | Planner shared by canvas and text rename. High (correctness of every rewrite)                          | Table-driven specs per reference kind |
| `language-server/model-change/ModelChanges.ts`         | modified             | Guard, snapshot rewrite, snapshots in history, `viewId` in result. High (central path)                 | Phase-1 specs stay green              |
| `language-server/lsp/RenameProvider.ts`, `module.ts`   | modified             | Provider re-enabled, gated to elements / deployment items. Medium (new LSP capability for all editors) | Provider spec                         |
| `language-server/filesystem/LikeC4ManualLayouts.ts`    | unaffected (checked) | `read` / `write` / `remove` cover the rewrite and the undo. Low                                        | —                                     |
| `diagram/editor-ui/*`, node toolbars, `hotkey.ts`      | modified             | Two buttons, two prompts, F2. Medium                                                                   | Editor-UI specs, E2E                  |
| `diagram/editor` port result                           | modified (additive)  | `handleChange` may return `viewId`; navigation after sync. Low                                         | Sync-queue spec                       |
| `likec4-spa` port, `vscode-preview` port, `vscode` ext | modified             | Pass back the result's `viewId`. Low                                                                   | Manual check in Code - OSS            |
| `core/manual-layout` drift                             | unaffected           | No new drift reason. A move into a shown parent reports `parent-changed` as today                      | —                                     |

Compatibility: no persisted format changes; additive public surfaces; no shim.

## Extensibility Integration Plan

Unaffected (no extension points on the editor path). The VSCode chat participant and
`packages/mcp` do not get the new ops (non-goal of phase 1, unchanged).

## Agent Manageability Plan

Integrators send the two ops through `likec4/change-view` or `updateView` and get the phase-1
structured errors plus `invalid-parent`. LSP clients get standard `textDocument/rename`. No
UI-only control exists.

## Config Lifecycle

Unaffected. No new config key or flag.

## Testing Approach

- Planner and handler specs: phase-1 harness (memfs, `createTestServices`, "DSL before → op → DSL
  after" inline snapshots), one table row per reference kind.
- `ModelChanges` integration specs: guard revert, snapshot rewrite, undo/redo with snapshots.
- Rename provider spec through Langium's test utilities.
- E2E against `likec4 start` for canvas rename, move and undo; manual Code - OSS pass.
- Details and IDs in [`_tests.md`](_tests.md).

## Development Sequencing

### Build Order

1. **Slice 1 — rename engine for elements (server)**: types, planner (rename), guard, snapshot
   rewrite, history with snapshots, `viewId` in the result. Gate: UT/IT green.
2. **Slice 2 — canvas rename of elements, both hosts**: F2, toolbar button, prompt, navigation on
   view id change. Depends on 1. Gate: E2E-001, E2E-002 (undo), Code - OSS check.
3. **Slice 3 — rename of deployment nodes and instances**: planner + UI in deployment views.
   Depends on 2.
4. **Slice 4 — importing projects**: imports and their references (rule 13). Depends on 1.
5. **Slice 5 — move engine (server)**: cut/paste, reference rewrite, include, guard, snapshots.
   Depends on 1.
6. **Slice 6 — canvas "Move to…", both hosts**. Depends on 5 and 2 (prompt plumbing). Gate:
   E2E-003.
7. **Slice 7 — text F2**: provider re-enabled on the planner. Depends on 1 (3 and 4 for full
   coverage).
8. **Slice 8 — QA pass in both hosts**.

### Technical Dependencies

- `pnpm exec tsc --build` after core changes; gitnexus impact on `ViewChange`,
  `LikeC4ModelChanges`, `LikeC4ManualLayouts` before editing.

## Monitoring and Observability

Existing loggers: `logger.debug` per op with the number of files and references rewritten; a
`logger.warn` with the code on every rejection.

## Technical Considerations

### Key Decisions

- **Reference segments from Langium's index, not text search** (ADR-001): the scope provider
  already resolves short names, unique-descendant shortcuts, `this`/`it` and imports; the index is
  the only source that knows what a token points to.
- **Guard by comparing resolutions, not only errors** (ADR-001): capture (a short name silently
  resolving to the renamed element) produces no error, only a different target.
- **Snapshots rewritten server-side** (ADR-002): a rename touches views other than the open one, so
  the client-side `save-view-snapshot` of phase 1 cannot do it.
- **Text F2 is text-only** (ADR-003): the editor applies the `WorkspaceEdit` itself, so the server
  cannot guard or revert it.

### Known Risks

- **Missed reference kinds** (a reference the index does not record). Mitigation: one spec row per
  grammar reference to elements and deployment items; the guard turns a miss into a refusal.
- **Guard cost** on large workspaces (two walks over all references of the affected projects).
  Mitigation: measured in IT; only the affected projects are walked.
- **Comment attachment on move**: only the comment lines directly above the statement (no blank
  line between) move with it. Trailing same-line comments move with the statement.

## Safety Invariants

1. A refused gesture leaves every `.c4` file and every snapshot byte-identical.
2. After an accepted gesture, every reference that resolved before resolves to the same element
   (under the FQN map), and no document gained errors.
3. Undo restores every file and snapshot of the entry, or none (`stale-undo`).
4. Per project, gestures run one at a time (phase-1 invariant 2).

## File References

### Repo Files

- `packages/language-server/src/lsp/RenameProvider.ts` — the disabled provider.
- `packages/language-server/src/module.ts:146,210` — commented-out bindings.
- `packages/language-server/src/references/scope-provider.ts` — short names, unique descendants,
  `this`/`it`, imports (what the planner must respect).
- `packages/language-server/src/model/fqn-index.ts:134-190` — `rootElements`, `directChildrenOf`,
  `uniqueDescedants`.
- `packages/language-server/src/like-c4.langium:99-105` — imports; `:213-248` — `FqnRef`,
  `StrictFqnRef`, `StrictFqnElementRef`; `:849-860` — `DeployedInstance` (optional name).
- `packages/language-server/src/model-change/deleteFromModel.ts:18-31` — `findReferences` usage.
- `packages/language-server/src/model-change/ModelChanges.ts:50-60,340-455` — guard, history.
- `packages/language-server/src/model-change/_anchors.ts`, `addElement.ts` — placement (rule 6).
- `packages/language-server/src/model/parser/ModelParser.ts:241` — relation ids hash the FQNs.
- `packages/language-server/src/model/parser/ViewsParser.ts:100` — unnamed view ids hash `viewOf`.
- `packages/language-server/src/filesystem/LikeC4ManualLayouts.ts` — snapshot read/write.
- `packages/core/src/manual-layout/calcDriftsFromSnapshot.ts` — node/edge matching (edges fall
  back to source/target).
- `packages/core/src/types/view-manual-layout.ts:14-45` — drift reasons.
- `packages/diagram/src/editor-ui/TitlePrompt.tsx`, `identifier.ts` — prompt and identifier
  validation to reuse.
- `packages/diagram/src/editor-ui/deleteFromModel.tsx` and
  `likec4diagram/custom/nodes/toolbar/ElementToolbar.tsx`, `CompoundToolbar.tsx` — toolbar
  placement.
- `packages/diagram/src/editor/actor/hotkey.ts` — F2 binding.

### Design and Analysis Sources

- `docs/requirements/visual-to-code/epic.md` — D7, D8, §5 Phase 2.
- `.compozy/tasks/visual-to-code/_spec.md` — phase-1 rules inherited here.

## Assumptions and Defaults

- Rewritten references use full FQNs (no shortest-form computation).
- The move list shows `title (fqn)`, filtered as the user types, top level first.
- The rename prompt's validation reuses the phase-1 identifier checks.

## Architecture Decision Records

- [ADR-001: Reference rewrite from the language server's index, with a resolution
  guard](adrs/adr-001.md)
- [ADR-002: Snapshots rewritten server-side and kept in the undo history](adrs/adr-002.md)
- [ADR-003: Text F2 shares the planner but not the guard or snapshots](adrs/adr-003.md)
