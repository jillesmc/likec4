---
title: "Visual-to-code editing (canvas → DSL), phase 1"
slug: visual-to-code
status: draft
created: 2026-10-12
source: docs/requirements/visual-to-code/epic.md (decisions D1–D13 agreed with owner)
baseline: main @ 3945a59aa
amended: 2026-10-18 (owner answers to Q2–Q8, slices 8–13)
follow_up: visual-to-code-rename-move (phase 2, separate spec)
---

# Part I — Product

## Overview

- **Motivating Problem**: today an architect can only change *how* a view looks from the canvas
  (layout, style, autoLayout, view title). Every change to *what the model contains*, such as a new
  relation, a new element, a retitle or a removal, means leaving the diagram, finding the right
  `.c4` file and block, typing DSL, and reloading. The simplest end-to-end behaviour that removes
  this pain is: **drag a connection from element A to element B on the canvas, and a correct,
  minimal `A -> B` relation appears in the `.c4` sources and on the diagram.** It must work in both
  the VSCode preview and `likec4 start`. Slice 1 delivers exactly this.
- **Who it is for**: architects and engineers who maintain LikeC4 models in this internal fork and
  prefer sketching on the canvas while keeping `.c4` files as the reviewed source of truth.
- **Why it is valuable**: canvas gestures become versionable, minimal DSL diffs (comments and
  formatting preserved), so a visual workflow no longer bypasses code review.

## Goals

- Users can create relations, elements, deployment nodes, deployed instances and dynamic-view steps
  from the canvas, and the result is written to the `.c4` sources.
- Users can retitle elements and deployment nodes in place.
- Users can hide items from one view (`Del`), and can delete an unreferenced definition from the
  model through an explicit, confirmed action.
- Every gesture produces a minimal text edit. The rest of the file (comments, formatting, ordering)
  stays byte-identical.
- An item created on the canvas is always visible in the view it was created in, without anyone
  touching the view's existing predicates.
- A gesture that would leave the sources invalid is refused, and the sources stay unchanged.
- Model edits can be undone and redone from the canvas, in `likec4 start` and in the VSCode preview,
  and the manual-layout snapshot stays in sync with the undone edit.
- New identifiers are confirmed by the user: a suggestion is prefilled and can be accepted with
  Enter or replaced by typing, without deleting it first.
- A new relation can get a kind and a technology at creation, and its title can be edited later.
- In dynamic views a new step can be inserted at a chosen position, and `Del` removes a step.
- In views with a manual layout, the user is told that new elements stay where they are dropped.
- Static builds (`likec4 build`) stay read-only. No editing affordance appears.

## User Stories

- US-001 – US-002: relations and elements in element views (slice 1 and the core palette)
- US-003: retitle
- US-004 – US-005: exclude from view and delete from model
- US-006: dev-server undo/redo
- US-007 – US-008: deployment views
- US-009: dynamic views
- US-010: read-only surfaces
- US-011: programmatic use (integrator persona)
- US-012 – US-018: owner decisions of 2026-10-18 (identifier prompt, relation kind/technology,
  relation retitle, step position, step removal, manual-layout notice, canvas undo in VSCode)

[Full user stories](_user_stories.md)

## Core Features

1. **Connect** (`onConnect`): element view → relation, with a popover for title, kind and
   technology (rule 16). Dynamic view → step, with a popover for title and position (rule 17).
2. **Palette + drop**: lists only kinds declared in `specification {}`. Dropping creates an element
   or a deployment node, or an `instanceOf` in deployment views. The container under the cursor
   becomes the parent. The popover asks for the title and the identifier (rule 5).
3. **Inline retitle**: double-click a node title or a relation label, edit, Enter commits, Esc
   cancels.
4. **Exclude** (`Del`): writes an `exclude` rule into the current view. This replaces today's
   snapshot-only node deletion. In dynamic views `Del` on a step removes the step (rule 8).
5. **Delete from model**: context-menu action with a confirmation dialog listing references. It is
   blocked while blocking references exist.
6. **Ghost feedback**: pending items render dashed until the recomputed view arrives. On rejection
   they disappear and a toast shows the error.
7. **Auto-include**: when a created item would not be visible through the view's predicates, an
   explicit `include` is appended in the same edit.
8. **Manual-layout continuity**: in views with a manual-layout snapshot, a new node lands at the
   drop position and the snapshot is updated. No drift is reported. A notice tells the user that
   new elements stay where they are dropped and must be positioned by hand (rule 18).
9. **Canvas undo/redo**: model edits join the canvas Ctrl+Z / Ctrl+Shift+Z history, in the dev
   server and in the VSCode preview (ADR-004).

Features 6–8 are cross-cutting and apply to features 1–5.

## Business Rules

1. **Source of truth**: `.c4` files. The canvas only sends intents and re-renders from the
   recomputed model. No optimistic model state survives a rejection.
2. **Minimal edits**: every change is a set of `TextEdit`s. Whole-file regeneration
   (`writeDSL` / `toDSL`) is forbidden for this feature.
3. **Placement of new elements and deployment nodes (D4)**: nested in the parent's block, in the
   file holding the parent's *definition* (not an `extend`). Without a parent, they go in the first
   `model {}` (or `deployment {}`) block of the file that defines the current view. If that block
   does not exist, it is appended at the end of that file. A parent without a body gets `{ }` added.
4. **Placement of new relations (ADR-001)**: inside the source element's definition block, as
   `-> target`. If the source is not editable (defined in another project or imported), the
   relation goes in the `model {}` of the view's file as `source -> target`.
5. **Identifiers (Q2, owner 2026-10-18)**: the drop popover asks for the identifier of a new
   element, deployment node or instance, prefilled with a suggestion. The suggestion is derived from
   the title as camelCase ASCII matching `/([a-zA-Z]|_+[a-zA-Z0-9])[-\w]*/`; for an instance, from
   the element's name. On a collision with a sibling, the numeric suffixes `2`, `3`, … are appended.
   A title producing an empty slug falls back to the kind name.
   - The suggestion follows the title while the user has not edited the identifier.
   - Focusing the identifier field selects its whole text, so typing replaces it; Enter in any
     field accepts the form as it is.
   - The suggestion is computed client-side with the same function the server uses (moved to
     `@likec4/core`). The server stays authoritative: a name that does not match the grammar is
     rejected (`invalid-name`), a taken one is rejected (`name-collision`). A request without
     `name` still derives one (integrators, US-011).
6. **Kinds (D10)**: only kinds present in `specification {}` are offered or accepted
   (`unknown-kind`). The canvas never writes to `specification`.
7. **Visibility (D5)**: before applying, the server predicts whether the new item is visible in the
   current view. If not, it adds `include <expr>` at the end of the view body, in the same edit.
   Existing predicates are never modified.
8. **Exclude (D6)**: `Del` on nodes writes `exclude <fqn>` for each selected node. On edges it
   writes `exclude <sourceFqn> -> <targetFqn>`. The model is not touched. Dynamic views have no
   `exclude` rule in the grammar; there `Del` on a step edge removes that step from the view
   (Q5, owner 2026-10-18), and `Del` on a node does nothing.
   - The step is located by its step id (`step-03`, `step-02:par.01`). A single `a -> b` step,
     top-level or inside a block (`par`, `alt` branch, `try`, …), is removed as a whole statement.
   - A step that is part of a series (`a -> b -> c`) is refused (`unsupported-in-view`, message
     `Steps of a chain cannot be removed from the canvas`).
   - A block left empty by the removal stays (an empty block is valid DSL).
9. **Delete from model (D6, confirmed by the owner on 2026-10-13)**:
   - Elements and deployment nodes are blocked while any reference exists: relations (either end),
     nested children, `instanceOf`, `extend`, dynamic steps, and view rules in *any* view
     (including the current one). The dialog lists the references as the reason.
   - Relations are never blocked. The dialog lists the views showing it, for information only.
   - An edge that aggregates more than one relation offers no "Delete from model".
10. **Retitle**: updates the existing title literal or `title:` property. Without either, it inserts
    the positional title after the identifier/kind. The same title is a no-op (no write). Quotes are
    escaped. Relations can be retitled too (Q6, owner 2026-10-18): the target is the relation id,
    the positional title goes right after the target reference, and only an edge backed by exactly
    one relation defined in this project offers it (other edges: `read-only-target`). An empty
    relation title removes the title literal or property. Step titles in dynamic views are not
    covered.
11. **Validity guard**: after applying, if any touched document gains new errors (parse, linking or
    validation errors with severity error), the change is reverted and the gesture is rejected
    (`invalid-result`).
12. **Staleness (ADR-002)**: the server re-validates every precondition at apply time (targets
    exist, no collision, kind exists, parent editable). Any mismatch rejects the gesture. There is
    no document-version token.
13. **Read-only surfaces**: without an editor port (static build, `ViewReact`), no editing
    affordance is rendered. It is absent, not disabled.
14. **Undo (D13, ADR-003, ADR-004)**: the server keeps an in-memory, per-project stack of the
    texts before and after each model edit, in `likec4 start` and in VSCode. Canvas Ctrl+Z /
    Ctrl+Shift+Z undo and redo model edits in both hosts. Undo is refused (`stale-undo`) when the
    affected file changed since that edit. The stack is lost on restart.
    - In VSCode the undo is applied as a `WorkspaceEdit` and saved, like any canvas change. The
      `.c4` editor's own undo keeps working as an alternative, but that path does not touch the
      manual-layout snapshot (the drift it causes is reported as today).
    - Undoing or redoing a model edit in a manual-layout view also brings the snapshot back in sync
      in the same Ctrl+Z (the node is removed from / restored to the snapshot).
15. **No auto-commit**: git is never touched.
16. **Relation kind and technology (Q4, owner 2026-10-18)**: connecting two elements in an element
    view opens a popover with title (optional), kind (optional, only kinds declared in
    `specification {}`) and technology (optional). Enter with nothing filled creates the plain
    relation. The relation is written as `-[kind]-> target 'title'`, and the technology as a
    `technology '…'` property in a body (the positional technology needs a description before it,
    which the canvas does not ask for). An undeclared kind is rejected (`unknown-kind`).
17. **Step position (Q3, owner 2026-10-18)**: connecting in a dynamic view opens a popover with
    title (optional) and position. The default is "At the end" (after the last top-level step);
    the other options are "Before step N" for each top-level step. Positions inside blocks are not
    offered.
18. **Manual-layout notice (Q7, owner 2026-10-18)**: when editing is enabled in a view that has a
    manual-layout snapshot, the palette shows a notice: `This view has a manual layout. New
    elements are placed where you drop them; move them to where they belong.` The first new element
    dropped in that view during the session also shows an info toast with the same text. No new
    drift reason is added.

## User Experience

- **Personas**: *Architect* (sketches in `likec4 start` in a browser), *VSCode author* (preview
  panel next to the `.c4` editor), *Viewer* (static site, read-only), *Integrator* (script/agent
  calling the LSP or RPC).
- **Primary flow (slice 1)**: open a view → hover node A → drag from its handle → drop on B → a
  dashed edge appears → within ~1 s it becomes a normal edge, and the `.c4` file contains
  `-> B` inside A's block.
- **Palette flow**: open the palette → drag a kind → drop (on a container or the canvas) → enter a
  title in the popover → Enter → a ghost node appears, then the real node.
- Surface-by-surface states are in [`_uiux.md`](_uiux.md).
- Accessibility: palette items and dialog are keyboard-reachable. Inline title edit uses a real
  `<input>`. Toasts are announced (Mantine notifications).

## High-Level Technical Constraints

- Must work through the existing editor seam: `LikeC4EditorCallbacks` → `ViewChange` →
  `likec4/change-view` (LSP) or `updateView` (vite RPC) → `LikeC4ModelChanges`.
- Repository layering rules (AGENTS.md) are binding: `packages/diagram` never imports `likec4:*` or
  the language server.
- Internal fork. Changes should stay additive and pattern-aligned to keep upstream rebases cheap.
- Feedback target: ghost-to-real in under 1 s for a 1k-element workspace on a dev laptop (user
  perception, not a CI gate).
- Agent manageability: the LSP request and vite RPC carry every new op, with structured error
  codes (US-011).
- Extension ecosystem: not applicable (no LikeC4 extension points involved).

## Non-Goals (Out of Scope)

- Identifier rename and moving elements in the hierarchy (D7/D8). These belong to the follow-up spec
  `visual-to-code-rename-move`, together with the FQN-aware rename provider.
- Writing to `specification {}` (D10).
- Changing existing view predicates (D5).
- Editing in static builds (`likec4 build`).
- Auto-commit or any git interaction (D13).
- Dedicated support and tests for `apps/playground`. New ops are forwarded unchanged by its port,
  and whether they work there is incidental.
- New MCP tools in `packages/mcp`.
- Changing the kind or technology of an existing relation (only its title, rule 10).
- Editing step titles, kinds or positions of existing steps in dynamic views; inserting a step
  inside a block.
- Keeping the manual-layout snapshot in sync when a model edit is undone with the `.c4` editor's
  own undo in VSCode (the canvas undo does, rule 14).

## Resolved Questions

Answered by the owner on 2026-10-18:

- **Q2 — naming**: ask for the identifier, prefilled with the derived suggestion, easy to accept
  or overwrite → rule 5, US-012.
- **Q3 — dynamic step order**: at the end by default, with a position choice → rule 17, US-015.
- **Q4 — relation kind/technology on connect**: popover now → rule 16, US-013.
- **Q5 — `Del` in dynamic views**: `Del` on a step removes the step → rule 8, US-016.
- **Q6 — relation title edit**: in scope → rule 10, US-014.
- **Q7 — drift**: no new drift reason; warn the user that new elements in a manual-layout view must
  be positioned by hand → rule 18, US-017.
- **Q8 — VSCode atomicity**: canvas Ctrl+Z must undo model edits in VSCode too and keep the
  snapshot in sync → rule 14, ADR-004, US-018. Snapshots keep their filesystem write.

## Open Questions

None.

---

# Part II — Technical

## Executive Summary

Extend the existing `ViewChange` union with eight phase-1 ops. Each gets its own CST-anchored
handler in `packages/language-server/src/model-change/`, following `changeElementStyle.ts`.
`LikeC4ModelChanges.applyChange` gains three things: precondition validation, visibility
prediction (computing the view over an in-memory patched copy of the parsed model, so the
auto-include is part of the *same* edit), and a multi-file `applyWorkspaceEdits` with a
post-apply error guard and revert. The hosts forward ops unchanged. Two host contracts change:
VSCode preview must **throw** on `success: false` (today it resolves silently), and the dev server
gains `undoChange`/`redoChange` RPCs.

In the diagram, new xyflow handlers (`onConnect`, `onDrop`, double-click title, context menu)
raise `change.view` on the existing editor actor. Ghost state lives in the actor and is cleared on
`view.synched` or on failure. Failures are already visible as `requested − applied` in
`executeChange`.

## MVP Boundary

The MVP is slices 1–4 (see Build Order): add-relation, palette/add-element, retitle, and
exclude/delete in **element views**, in both hosts. Slice 1 ships first and solves the Motivating
Problem on its own. Post-MVP: dev-server undo (5), deployment views (6), dynamic views (7). Out of
scope: everything under Non-Goals.

## Developer Experience

- [Developer experience contract](_dx.md): `ViewChange` ops, the `ChangeView` LSP request and error
  codes, the vite RPC `updateView` / `undoChange` / `redoChange`, and the `LikeC4EditorCallbacks`
  contract change.
- [UI change map](_uiux.md): handles, palette, title editor, context menu, delete dialog, ghost,
  toasts.

## System Architecture

```
packages/diagram (UI contract)
  xyflow onConnect / onDrop / title dblclick / context menu / Del
    → editor actor: 'change.view' { change } + ghost added to context
    → sync queue (unchanged) → executeChange → port.handleChange
    → on failure: ghost removed + toast; on view.synched: ghosts cleared
    → D12: after sync, if manual snapshot exists → place new node at ghost position
           → 'save-view-snapshot' (existing op)
hosts (forward only)
  likec4-spa ViewEditor → likec4:rpc updateView / undoChange / redoChange
  vscode-preview editorPort → ExtensionApi.change (now throws on failure)
packages/vite-plugin  updateView (unchanged), undoChange, redoChange (new)
packages/language-server  LikeC4ModelChanges
  applyChange(params):
    1. dispatch op → handler → { edits: Map<uri, TextEdit[]>, expect }   (pure, CST-based)
    2. preconditions (FqnIndex, specification, editability)          → error code
    3. visibility prediction (core computeView on patched parsed data) → + include edit
    4. applyWorkspaceEdits(edits)  (LSP applyEdit | TextDocument.applyEdits + writeFile)
    5. DocumentBuilder.update(uris) → guard: new errors? → revert → 'invalid-result'
    6. no LSP connection: push inverse edits on the undo stack
```

## Architectural Boundaries

- `packages/core`: types only (`ViewChange` members, `ViewChangeErrorCode`). No new runtime
  dependencies.
- `packages/diagram`: `editor/` owns ghost state and the new events. Palette, title editor, context
  menu and delete dialog go in a new sibling feature folder `src/editor-ui/`, which may import
  `editor/` but not `likec4diagram/state` internals beyond the existing public hooks. No `likec4:*`
  imports and no language-server calls.
- `packages/language-server/src/model-change/`: one file per op plus shared `_anchors.ts`
  (indentation and closing-brace handling extracted from `changeElementStyle.ts`).
- `packages/vite-plugin`: imports from `@likec4/language-server` stay type-only. The undo stack
  lives in the language server (`LikeC4ModelChanges`), not in the plugin.
- `packages/likec4-spa`, `packages/vscode-preview`, `packages/vscode`: forwarding only.

## Implementation Design

### Core Interfaces

`packages/core/src/types/view-changes.ts` (additive):

```ts
export namespace ViewChange {
  // existing: ChangeElementStyle, SaveViewSnapshot, ResetManualLayout, ChangeAutoLayout, ChangeProperty

  export interface AddRelation {
    op: 'add-relation'
    source: scalar.Fqn
    target: scalar.Fqn
    title?: string
  }

  export interface AddElement {
    op: 'add-element'
    parent: scalar.Fqn | null
    kind: scalar.ElementKind
    title: string
    /** Identifier; derived from title when omitted (rule 5) */
    name?: string
  }

  export interface AddDeploymentNode {
    op: 'add-deployment-node'
    parent: scalar.DeploymentFqn | null
    kind: scalar.DeploymentKind
    title: string
    name?: string
  }

  export interface AddInstance {
    op: 'add-instance'
    parent: scalar.DeploymentFqn
    element: scalar.Fqn
    name?: string
  }

  /** Appended at the end of the top-level steps, or before `beforeStep` (rule 17) */
  export interface AddDynamicStep {
    op: 'add-dynamic-step'
    source: scalar.Fqn
    target: scalar.Fqn
    title?: string
  }

  export type ExcludeTarget =
    | { node: scalar.Fqn | scalar.DeploymentFqn }
    | { edge: { source: scalar.Fqn | scalar.DeploymentFqn; target: scalar.Fqn | scalar.DeploymentFqn } }

  export interface ExcludeFromView {
    op: 'exclude-from-view'
    targets: NonEmptyArray<ExcludeTarget>
  }

  export interface DeleteFromModel {
    op: 'delete-from-model'
    target:
      | { element: scalar.Fqn }
      | { deploymentNode: scalar.DeploymentFqn }
      | { relation: scalar.RelationId }
  }

  export interface ChangeTitle {
    op: 'change-title'
    target: scalar.Fqn | scalar.DeploymentFqn
    title: string
  }
}

export type ViewChangeErrorCode =
  | 'not-found'
  | 'invalid-name'
  | 'name-collision'
  | 'unknown-kind'
  | 'read-only-target'
  | 'has-references'
  | 'unsupported-in-view'
  | 'invalid-result'
  | 'apply-failed'
  | 'stale-undo'
```

Amendment of 2026-10-18 (additive, slices 8–13):

```ts
export namespace ViewChange {
  export interface AddRelation {
    // ...as above
    /** Relationship kind declared in specification (rule 16) */
    kind?: scalar.RelationshipKind
    /** Written as a `technology` property in the relation body (rule 16) */
    technology?: string
  }

  export interface AddDynamicStep {
    // ...as above
    /** 0-based index among the top-level steps to insert before; at the end when omitted (rule 17) */
    beforeStep?: number
  }

  export interface ChangeTitle {
    op: 'change-title'
    /** Element / deployment fqn, or a relation (rule 10) */
    target: scalar.Fqn | scalar.DeploymentFqn | { relation: scalar.RelationId }
    title: string
  }

  /** Remove a step from a dynamic view (rule 8) */
  export interface RemoveDynamicStep {
    op: 'remove-dynamic-step'
    step: scalar.StepPath
  }
}
```

`deriveIdentifier` / `isValidIdentifier` move from `language-server/src/model-change/_naming.ts`
to `@likec4/core` (planned: `packages/core/src/utils/identifier.ts`, exported from
`@likec4/core/utils`), so the drop popover computes the same suggestion as the server.

Placement in the view: `ViewChange` ops stay view-scoped (`viewId` in `ChangeView.Params`), which
D5 and the include edit require.

`packages/language-server/src/protocol.ts`: `ChangeView.Res` failure branch gains
`code?: ViewChangeErrorCode` (additive). There are new requests `UndoChange` / `RedoChange`
(`likec4/undo-change`, `likec4/redo-change`, params `{ projectId?: string }`, result =
`ChangeView.Res`).

`packages/diagram/src/editor/LikeC4EditorCallbacks.tsx` (additive, optional):

```ts
export interface LikeC4EditorCallbacks {
  // existing: applySemanticLayout?, fetchView, handleChange
  /** Revert the latest model edit. Present where canvas undo of model edits is supported (dev server, VSCode since ADR-004). */
  undoModelChange?: undefined | ((viewId: t.ViewId) => Promise<void>)
  redoModelChange?: undefined | ((viewId: t.ViewId) => Promise<void>)
}
```

`handleChange` contract (documented, not a type change): it **must reject** when the change was
not applied. The SPA already does this (`updateView` throws). VSCode preview must be fixed.

Handler shape (`model-change/*.ts`):

```ts
// packages/language-server/src/model-change/_anchors.ts
export interface ModelChangePlan {
  edits: Map<string /* uri */, TextEdit[]>
  modifiedRange: Location
}
```

Handlers reject with `throw new ModelChangeError(code, message)` (`model-change/ModelChangeError.ts`),
which `applyModelChange` converts into `{ success: false, code, error }`.

### Data Models

- No new storage. The undo stack is in memory:
  `Array<{ uri: string; afterHash: string; inverse: TextEdit[] }>` per project, max 100 entries
  (older entries are dropped), cleared on server restart.
- Editor actor context gains `ghosts: Array<{ id: string; change: t.ViewChange; position?: XYPoint }>`.
- Manual-layout snapshots: unchanged format.

### API Endpoints

- LSP `likec4/change-view` (existing): accepts the new ops. Failures return
  `{ success: false, error, code }`.
- LSP `likec4/undo-change`, `likec4/redo-change` (new): used by the vite plugin and, since
  ADR-004, by the VSCode extension on behalf of the preview. With an LSP connection the restored
  texts are applied as one `WorkspaceEdit` and the extension saves the modified documents.
- vite RPC `updateView` (existing, unchanged signature), `undoChange`, `redoChange` (new, in
  `src/rpc/protocol.ts`, `src/rpc/functions/`, wired in `src/rpc/rpc.ts`). They throw on failure.

## Integration Points

None outside the repository.

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
|---|---|---|---|
| `core/types/view-changes.ts` `ViewChange` | modified (additive) | 8 new union members. Every `switch` with `nonexhaustive` breaks at compile time (desired). Medium | Run gitnexus impact. `pnpm exec tsc --build` before downstream typecheck |
| `language-server/model-change/ModelChanges.ts` | modified | `applyChange` dispatch, preconditions, prediction, guard. `applyTextEdits` replaced by `applyWorkspaceEdits(Map)`. High (central path) | Keep the existing ops' behaviour byte-identical, covered by existing specs |
| `language-server/protocol.ts` | modified (additive) | `code?` on failure, 2 new requests. Low | — |
| `vite-plugin/rpc/*` | modified (additive) | `undoChange` / `redoChange`. Low | Add to `protocol.ts`, `rpc.ts` |
| `diagram/editor/actor/*` | modified | Ghosts, model-history entries, failure → toast. Medium (sync queue is subtle) | Extend `state.sync-queue.spec.ts` |
| `diagram/editor/actor/actions.ts` `deleteNodesAndEdges` | **delete target** | Snapshot-only node removal on `Del` is replaced by `exclude-from-view`. Internal behaviour, hard cut in the same change, no fallback | Remove the action and its `delete.nodes-edges` handling. The event now emits `exclude-from-view` |
| `diagram/likec4diagram/DiagramXYFlow.tsx` | modified | `onConnect`, `onDrop`, `nodesConnectable`, title dblclick, context menu; `onDelete` now emits exclude. Medium | Gate on `!enableReadOnly && !isStub` |
| `diagram/editor/LikeC4EditorCallbacks.tsx` | modified (additive, public API) | Optional undo/redo; documented reject-on-failure. Low | JSDoc |
| `vscode-preview/src/state.ts` `handleChange` | modified | Throw when `success: false`. Low | — |
| `likec4-spa/pages/ViewEditor.tsx` | modified | Wire `undoModelChange` / `redoModelChange`. Low | — |
| `apps/playground` | unaffected (checked) | Forwards ops to its LSP and ignores snapshot ops | None (non-goal) |
| `core/manual-layout/*` drift | unaffected (Q7 resolved) | No new drift reasons. Gestures and canvas undo keep snapshots in sync | — |
| `language-server/model-change/_naming.ts` | **moved** | `deriveIdentifier` / `isValidIdentifier` move to `@likec4/core` (slice 8). Hard cut, callers updated in the same change | `pnpm exec tsc --build` |
| `language-server/model-change/ModelChanges.ts` history | modified | History is recorded with an LSP connection too; undo/redo apply through `applyWorkspaceEdits` (ADR-004). Medium | Extend `undo.spec.ts` with a faked connection |
| `language-server/model-change/addRelation.ts`, `addDynamicStep.ts`, `changeTitle.ts` | modified | kind/technology, `beforeStep`, relation target. Low | Handler specs |
| `language-server/model-change/removeDynamicStep.ts` | new | Step lookup by step path, whole-statement removal. Medium | Handler spec |
| `vscode/src/useRpc.ts`, `panel/activateMessenger.ts`, `vscode-preview/src/state.ts` | modified | Messenger requests for undo/redo, port gains `undoModelChange` / `redoModelChange`, modified documents saved. Medium (no automated test runs the extension) | Manual check in Code - OSS |
| `diagram/editor-ui/*` | modified | Identifier field, connect popover (kind, technology, position), edge-label retitle, manual-layout notice. Medium | Editor UI specs, E2E |
| `generators/likec4` | unaffected | Not used (rule 2) | — |

SD-013 regimes: no persisted user state changes. The public TS/LSP surfaces change additively, so
no shim is needed. The internal delete target (`deleteNodesAndEdges`) is a hard cut with no
compatibility shim.

## Extensibility Integration Plan

Unaffected. Checked: LikeC4 has no plugin/hook system on the editor path. `packages/mcp` tools are
unchanged (non-goal). The VSCode chat participant (`useLikeC4ChatParticipant.ts`) calls
`changeView` with existing ops only.

## Agent Manageability Plan

Agents use the same surfaces as the UI: the LSP request `likec4/change-view` (VSCode/LSP clients)
or the vite RPC `updateView` (dev server). Every failure carries a deterministic
`ViewChangeErrorCode` plus a human message, and success returns the modified `Location`. See
`_dx.md` §Errors. No UI-only control exists.

## Config Lifecycle

Unaffected. Checked: `likec4.config.*` (`manualLayouts` dir is read but not changed) and the
generated `packages/config/schema.json`. There is no new key, and no feature flag (internal fork,
always on when an editor port exists).

## Testing Approach

- Vitest everywhere. Handler specs follow `changeElementStyle.spec.ts`: memfs + `createTestServices`,
  "DSL before → op → DSL after" with inline snapshots.
- `ModelChanges` integration specs run the full `applyChange` path without an LSP connection
  (FS write branch) and with a faked `Connection.workspace.applyEdit`.
- Editor actor specs extend `state.sync-queue.spec.ts` with a fake port.
- E2E (Playwright, `e2e/`) runs against `likec4 start` on a fixture project for slice 1 and the
  palette.
- Details and IDs are in [`_tests.md`](_tests.md).

## Development Sequencing

### Build Order

1. **Slice 1 — add-relation (element views), both hosts.** Contracts: the `AddRelation` type and
   error codes → `applyWorkspaceEdits(Map)` + guard + preconditions + visibility prediction →
   `addRelation.ts` → VSCode preview throw-on-failure → diagram `onConnect`, ghost edge,
   failure toast. Gate: UT/IT for add-relation green, E2E-001 green, manual check in VSCode.
2. **Slice 2 — add-element + palette + D12.** Depends on 1 (pipeline, ghost). Gate: E2E-002.
3. **Slice 3 — change-title.** Depends on 1.
4. **Slice 4 — exclude-from-view (replaces `deleteNodesAndEdges`) + delete-from-model + dialog.**
   Depends on 1. The cleanup of the old delete path is in this slice.
5. **Slice 5 — dev-server undo/redo (ADR-003).** Depends on 1. Independent of 2–4.
6. **Slice 6 — deployment views**: add-deployment-node, add-instance; exclude/title reuse slices 3–4.
7. **Slice 7 — dynamic views**: add-dynamic-step.

Amendment of 2026-10-18 (owner answers Q2–Q8). All depend on slices 1–7, which are delivered.

8. **Slice 8 — identifier prompt (Q2)**: move naming to core, identifier field in the drop popover
   for elements, deployment nodes and instances.
9. **Slice 9 — connect popover with kind and technology (Q4)**: `AddRelation.kind/technology`,
   popover on connect in element views.
10. **Slice 10 — relation retitle (Q6)**: `ChangeTitle` with a relation target, double-click on an
    edge label. Depends on 9 only for the shared popover code, if any.
11. **Slice 11 — dynamic views: step position and step removal (Q3, Q5)**: `beforeStep`,
    `remove-dynamic-step`, position select in the connect popover, `Del` on steps.
12. **Slice 12 — manual-layout notice (Q7)**: palette notice and first-drop toast.
13. **Slice 13 — canvas undo in VSCode (Q8, ADR-004)**: server history with an LSP connection,
    extension requests, preview port, snapshot sync on undo.

### Technical Dependencies

- `pnpm generate` and `pnpm exec tsc --build` after core type changes.
- gitnexus impact on `ViewChange`, `LikeC4EditorCallbacks`, `LikeC4ModelChanges`,
  `applyTextEdits`, `pushToSyncQueue` before editing (graph indexers under-report `applyChange`
  callers; confirm with grep).

## Monitoring and Observability

Existing loggers only: `logger.debug` per op in `ModelChanges`, plus a `logger.warn` with the code
on every rejection. The vite plugin keeps its `view:onChange` line. There are no metrics.

## Technical Considerations

### Key Decisions

- **Extend `ViewChange` rather than add a parallel contract**: the hosts forward it opaquely, so new
  ops need zero host changes. Rejected: a separate `ModelChange` request, which would mean new
  plumbing in three hosts.
- **Visibility predicted in memory, not by apply-then-recompute**: keeps model edit + include in
  one `WorkspaceEdit`, so VSCode undo never leaves a dangling `include`. It uses core `computeView`
  over the parsed model data patched with the new element/relation. Rejected: two sequential
  applies (two undo stops, dangling-include risk).
- **Post-apply guard only** (no pre-parse): simpler, and it catches linking/validation errors that a
  parse-only pre-check would miss. The cost is a revert edit (in VSCode, an extra undo stop) in the
  rare failure case.
- **D12 snapshot update happens client-side after sync** (existing `save-view-snapshot` op, with the
  new node positioned at the ghost's drop point). This reuses `applyChangesToManualLayout`, and the
  server needs no position. The trade-off is Q8.
- **Failure detection reuses `executeChange`'s `requested − applied`** rather than a new result
  type.

### Known Risks

- **CST anchoring edge cases** (single-line blocks, `}` on the same line, tabs, CRLF, missing
  `model {}`). Mitigation: shared `_anchors.ts` with dedicated specs (UT-001…UT-008).
- **Visibility prediction diverging from the real compute** (e.g. global predicates). The
  prediction uses the same `computeView` as the real compute, so divergence is limited to
  differences between parsed and recomputed data. A mismatch is not detected: the user just
  doesn't see the item. IT-003 covers the main path.
- **Sync-queue regressions** for layout ops. Mitigation: the existing specs must stay green.
- **Upstream rebase conflicts** in `DiagramXYFlow.tsx` and `ModelChanges.ts`. Mitigation: keep the
  new logic in new files and add only call sites in the existing ones.

## Safety Invariants

1. A rejected gesture leaves every `.c4` file byte-identical to its state before the request.
2. Per project, `applyChange` / `undoChange` / `redoChange` execute strictly one at a time
   (a per-project promise chain in `LikeC4ModelChanges`).
3. An undo entry is applied only if every file's current content equals the entry's text after the
   edit (before it, for redo). Otherwise that entry is dropped and `stale-undo` is returned. This
   holds with and without an LSP connection (ADR-004).
4. Edits never touch text outside the computed insertion/replacement ranges.
5. The canvas never renders an editing affordance when `enableReadOnly` is true or the editor port
   is a stub.
6. Ghosts are cleared on `view.synched` or on failure of their change, and never outlive the editor
   actor.

## File References

### Repo Files

- `packages/core/src/types/view-changes.ts` — the `ViewChange` union to extend.
- `packages/core/src/types/scalar.ts:71-107` — `Fqn`, `ElementKind`, `DeploymentFqn`,
  `DeploymentKind`, `RelationshipKind`, `RelationId`.
- `packages/core/src/types/view-manual-layout.ts:14-40` — drift reasons (Q7).
- `packages/core/src/compute-view/index.ts` — `computeView` for visibility prediction.
- `packages/language-server/src/model-change/ModelChanges.ts:23-230` — `applyChange` dispatch,
  `convertToTextEdit`, `applyTextEdits` (LSP vs FS branch) to generalise.
- `packages/language-server/src/model-change/changeElementStyle.ts` — reference CST-anchor pattern.
- `packages/language-server/src/model-change/changeElementStyle.spec.ts:1-60` — test harness (memfs,
  `createTestServices`).
- `packages/language-server/src/model/model-locator.ts:116-330` — `locateElement`,
  `locateDeploymentElement`, `locateRelation`, `locateViewAst`, `locateDynamicViewStep`.
- `packages/language-server/src/like-c4.langium:114-160` — `Model`, `Element`, `ElementBody`
  (placement targets).
- `packages/language-server/src/like-c4.langium:245-275` — `Relation` syntax.
- `packages/language-server/src/like-c4.langium:352-444` — dynamic view body; no `exclude` (Q5).
- `packages/language-server/src/like-c4.langium:827-870,935-938` — deployment nodes, `instanceOf`,
  deployment `exclude`.
- `packages/language-server/src/like-c4.langium:1267` — `IdTerminal` regex (rule 5).
- `packages/language-server/src/protocol.ts:286-303` — `ChangeView` request/response.
- `packages/language-server/src/filesystem/LikeC4ManualLayouts.ts:214-255` — snapshot writes via FS
  (Q8, unchanged by ADR-004).
- `packages/language-server/src/model-change/_naming.ts` — identifier derivation to move to core
  (rule 5).
- `packages/core/src/types/scalar.ts:147-201` — `StepPath` / step ids (rule 8).
- `packages/core/src/compute-view/dynamic-view/` — how step paths are assigned (`step-02:par.01`).
- `packages/language-server/src/like-c4.langium:655-810` — `StepStatement`, blocks, `StepSeries`.
- `packages/diagram/src/editor/actor/state.sync-queue.ts:300-380` — model history entries and
  `refreshManualLayout` after undo/redo (snapshot sync, rule 14).
- `packages/diagram/src/editor/LikeC4EditorCallbacks.tsx` — the port contract.
- `packages/diagram/src/editor/useEditorActorLogic.ts:39-61` — `executeChange` swallows errors and
  returns `applied`.
- `packages/diagram/src/editor/actor/types.ts` — events and context (add ghosts).
- `packages/diagram/src/editor/actor/actions.ts:95-240` — undo/redo history, `deleteNodesAndEdges`
  (delete target), `pushToSyncQueue`.
- `packages/diagram/src/editor/actor/state.sync-queue.ts` — queue states.
- `packages/diagram/src/editor/actor/hotkey.ts` — the existing Ctrl+Z / Ctrl+Shift+Z bindings.
- `packages/diagram/src/editor/applyChangesToManualLayout.ts` — D12 merge.
- `packages/diagram/src/likec4diagram/DiagramXYFlow.tsx:284-292` — current `onDelete` wiring.
- `packages/likec4-spa/src/pages/ViewEditor.tsx:48-70` — SPA port.
- `packages/likec4-spa/src/routes/_single/view.$viewId.index.tsx:7` — `isRpcAvailable` gate
  (read-only in builds).
- `packages/vscode-preview/src/state.ts:227-250` — VSCode port (swallows failures).
- `packages/vscode/src/panel/activateMessenger.ts:128-150` — extension-side handler (shows the
  error in output, returns the result).
- `packages/vite-plugin/src/rpc/functions/updateView.ts` — throws on failure (pattern for undo/redo
  RPC).
- `apps/playground/src/monaco/LanguageClientSync.tsx:218-232` — playground forwarding (non-goal,
  unaffected).

### Design and Analysis Sources

- `docs/requirements/visual-to-code/epic.md` — the original diagnosis and decisions D1–D13. This
  spec supersedes its Target architecture / Delivery plan sections.

## Assumptions and Defaults

- Q2–Q8 are resolved (see Resolved Questions). The defaults below were chosen in the amendment
  without a separate owner decision:
  - Step positions are offered only between top-level steps (rule 17).
  - Steps of a series (`a -> b -> c`) are not removable from the canvas (rule 8).
  - The relation technology is written as a body property, not positionally (rule 16).
  - The manual-layout toast is shown once per view per session (rule 18).
- The undo stack is capped at 100 entries per project.
- A palette popover's default title is `New <kind>`.
- Indentation: copied from the parent's first child line, else parent indent + the file's detected
  unit (tab, or 2 spaces when undetectable).
- Line endings: the file's existing EOL is preserved.

## Architecture Decision Records

- [ADR-001: New relations are written inside the source element's block](adrs/adr-001.md) —
  resolves Q1.
- [ADR-002: Precondition re-validation instead of document-version tokens](adrs/adr-002.md) —
  replaces the epic's "version" check.
- [ADR-003: Dev-server model undo is a server-side inverse-edit stack joined to canvas
  history](adrs/adr-003.md) — implements D13 alongside the existing layout undo.
- [ADR-004: Canvas undo of model edits in VSCode through the server history](adrs/adr-004.md) —
  resolves Q8; amends ADR-003.
