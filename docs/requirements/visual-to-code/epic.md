---
type: Epic
title: "Visual-to-code editing (canvas → DSL)"
description: Let users create, connect, delete, retitle (and later rename/move) model elements directly on the diagram canvas, with every gesture written back as minimal, versionable edits to the .c4 sources.
status: draft (decisions agreed, not started)
tags: [epic, editor, diagram, language-server, model-change, internal-fork]
created: 2026-10-12
---

# Epic: Visual-to-code editing (canvas → DSL)

> Handoff document. Contains the diagnosis of what exists today, every scope decision agreed with
> the owner, the target architecture, the phased plan, and the gotchas found while mapping the
> code. An agent picking this up should NOT need to re-investigate; verify line numbers before
> editing (they were taken on `main` @ `3945a59aa`).

## Context

- **Destination: internal fork** (not an upstream PR). We optimise for our use case, but keep
  changes aligned with existing patterns to minimise rebase pain against upstream.
- Repository rules in `AGENTS.md` still apply (layering, no `as` casts, dprint, Vitest, etc.).

## Diagnosis — what exists today (verified)

LikeC4 already has **partial** canvas→code write-back, scoped to *view-level* changes only.
There is **no** way to create/connect/delete/rename model elements from the canvas: no
`onConnect`, `onDrop` or `nodesConnectable` anywhere in `packages/diagram/src`.

| Canvas action | Written to | Implementation |
|---|---|---|
| Drag nodes/edges (manual layout) | JSON5 snapshot in `.likec4/` (dir configurable via `manualLayouts` in project config) | `packages/language-server/src/filesystem/LikeC4ManualLayouts.ts` (`write` ~L213) |
| Change element color/shape/border/opacity (node toolbar) | DSL `style <fqn> { … }` inside the view | `packages/language-server/src/model-change/changeElementStyle.ts`; UI emitter: `packages/diagram/src/likec4diagram/custom/nodes/toolbar/useHandlers.ts` |
| Change autoLayout direction | DSL `autoLayout …` | `packages/language-server/src/model-change/changeViewLayout.ts` |
| Change view title/description/tags | DSL | `packages/language-server/src/model-change/viewChange.ts` |
| Create element / relation, delete, rename, move | — | **does not exist** |

### End-to-end flow (the seam we extend)

```
xyflow canvas / node toolbar
  → editor actor (XState) packages/diagram/src/editor/actor/
      actions.ts pushToSyncQueue (L218): dedupes, keeps only the latest layout change
      state.sync-queue.ts: serialises ops, waits for 'view.synched'
  → executeChange  packages/diagram/src/editor/useEditorActorLogic.ts (~L41)
      → port.handleChange(viewId, change: ViewChange)
  PORT = LikeC4EditorCallbacks  packages/diagram/src/editor/LikeC4EditorCallbacks.tsx (L27-53)
      { fetchView(viewId, layout), handleChange(viewId, change), applySemanticLayout? }
      3 host implementations (all just forward the ViewChange):
        - packages/likec4-spa/src/pages/ViewEditor.tsx:54   → likec4:rpc updateView
              → packages/vite-plugin/src/rpc/functions/updateView.ts → likec4.editor.applyChange
        - packages/vscode-preview/src/state.ts:235          → LSP request ChangeView
              → packages/language-server/src/Rpc.ts:329 → ModelChanges.applyChange
        - apps/playground/src/routes/w.$workspaceId/$viewId.tsx (~L193)
  → LikeC4ModelChanges.applyChange  packages/language-server/src/model-change/ModelChanges.ts (L23)
      - save-view-snapshot / reset-manual-layout → ManualLayouts (JSON5)
      - otherwise: ModelLocator.locateViewAst → CST positions → convertToTextEdit → TextEdit[]
      - applyTextEdits (L165):
          * LSP connection present (VSCode): lsp.workspace.applyEdit  (editor undo, buffer dirty)
          * no connection (CLI / vite dev server): TextDocument.applyEdits + FileSystemProvider.writeFile
          * then DocumentBuilder.update([uri])
  → model recomputed → HMR (SPA nanostore) / LSP notify (VSCode) → canvas re-renders
```

- Contract type: `ViewChange` union in `packages/core/src/types/view-changes.ts` (5 ops today:
  `change-element-style`, `save-view-snapshot`, `reset-manual-layout`, `change-autolayout`,
  `change-property`).
- LSP protocol: `ChangeView` namespace in `packages/language-server/src/protocol.ts` (~L286).
- Manual-layout merge already exists: `packages/diagram/src/editor/applyChangesToManualLayout.ts`.

### Building blocks that already exist (reuse, don't rebuild)

- `LikeC4ModelLocator` (`packages/language-server/src/model/model-locator.ts`):
  `locateElement` (L116), `locateDeploymentElement` (L130), `locateRelation` (L149),
  `locateViewAst` (L187), `locateView` (L218), `locateDynamicViewStep` (L316).
- `FqnIndex` (`services.likec4.FqnIndex`) for resolving refs and collision checks.
- `changeElementStyle.ts` is the reference pattern for "find anchor in CST → compute indent →
  emit minimal TextEdit", including handling `}` on the same line.
- Spec pattern: `changeElementStyle.spec.ts`, `viewChange.spec.ts` (DSL before → change → DSL after).

### Gotchas found

- **Do NOT use `writeDSL` / `LikeC4.toDSL()`** for this. The generator
  (`packages/generators/src/likec4/`) regenerates whole files and loses comments/formatting.
  All writes must be minimal `TextEdit`s.
- **Rename provider is disabled**: `LikeC4RenameProvider` exists in
  `packages/language-server/src/lsp/RenameProvider.ts` but its binding is commented out in
  `packages/language-server/src/module.ts` (L146, L210) and its export in `lsp/index.ts`.
  Cross-file FQN rename is therefore NOT reliable today → drives the phase-2 split below.
- `applyTextEdits` has a commented-out formatter block (no formatting of inserted text today);
  generated text must be correctly indented by the handler itself.
- Graph indexers under-report callers of `applyChange` (Langium DI / receiver typing). Empty
  caller sets are a blind spot, not dead code — confirm with text search.
- `packages/core` is `composite: true`: after adding types to core run `pnpm exec tsc --build`
  before typechecking downstream (see AGENTS.md).
- Production `likec4 build` has no RPC — editing only works in VSCode preview and `likec4 start`
  (dev server). Must stay read-only in static builds.

## Decisions (agreed with owner)

| # | Topic | Decision |
|---|---|---|
| D1 | Scope | Relations + elements + hierarchy/rename. Rename-ID and move are **phase 2**. |
| D2 | Destination | Internal fork. |
| D3 | Editing surfaces | **Both** VSCode preview (LSP `applyEdit`, native undo) and dev server `likec4 start` (direct FS write). |
| D4 | Where new elements are written | **Nested inside the parent's block, in the parent's file.** Top-level elements go into the `model {}` of the file that defines the current view. |
| D5 | Visibility in predicate-based views | **Auto-include only when needed**: after applying, recompute the view; if the new item isn't visible, append explicit `include <fqn>` to the view. Never modify existing predicates. |
| D6 | Delete semantics | **Two distinct gestures**: `Del` = `exclude <fqn>` in this view only. Explicit "Delete from model" removes the definition, with a confirmation listing affected views/relations, and is **blocked** while references remain. |
| D7 | Rename | Phase 1: edit **title** only (double-click). Phase 2: identifier rename via a fixed, FQN-aware rename provider, applied as multi-file WorkspaceEdit. |
| D8 | Move in hierarchy | **Phase 2**, sharing the "change FQN + rewrite all refs" engine with D7. In phase 1, dragging into a container only affects layout. |
| D9 | View types in phase 1 | **All**: element views, deployment views, dynamic views. |
| D10 | Kinds | Palette lists only kinds from `specification {}`. Canvas **never** writes to `specification`. |
| D11 | UI feedback | **Ghost + confirmation**: item shown as pending (dashed) until the recomputed model arrives; on rejection (version conflict / parse error) the ghost disappears with a toast. File is always the source of truth. |
| D12 | Manual layout interplay | If the view has a manual-layout snapshot, the new node is placed at the **drop position** and the snapshot is updated in the same gesture (reuse `applyChangesToManualLayout`). No snapshot → Graphviz decides. |
| D13 | Undo / versioning | **In-memory undo stack** of inverse TextEdits per session (Ctrl+Z / Ctrl+Shift+Z) for the dev server; VSCode uses native undo. Git commits stay manual — no auto-commit. |

## Target architecture

### 1. Contract (packages/core)

Extend the existing `ViewChange` union in `packages/core/src/types/view-changes.ts` rather than
creating a parallel contract. Rationale: every gesture happens in a view context (D5 needs the
`viewId`), and the three hosts forward `ViewChange` opaquely — new ops reach them with zero host
changes.

Phase 1 ops (names indicative):

| op | payload (sketch) | DSL effect |
|---|---|---|
| `add-element` | `parent: Fqn \| null, kind, name, title?, position?` | `name = kind 'title'` nested in parent (D4) + optional `include` (D5) + snapshot merge (D12) |
| `add-relation` | `source, target, kind?, title?, technology?` | `source -> target 'title'` (placement: see open question Q1) |
| `add-deployment-node` | `parent: DeploymentFqn \| null, kind, name, title?` | in `deployment {}` |
| `add-instance` | `parent: DeploymentFqn, element: Fqn, name?` | `instanceOf element` |
| `add-dynamic-step` | `source, target, title?, after?: stepId` | step `source -> target` inside the dynamic view, ordered |
| `exclude-from-view` | `targets: (Fqn \| DeploymentFqn \| relationId)[]` | `exclude …` rule in the view (D6) |
| `delete-from-model` | `target: Fqn \| DeploymentFqn \| relationId` | remove definition; refuse if referenced (D6) |
| `change-title` | `target, title` | replace/insert title literal (D7 phase 1) |

Phase 2 ops: `rename-element { fqn, newName }`, `move-element { fqn, newParent }`.

Also extend: `ChangeView` LSP protocol types (`packages/language-server/src/protocol.ts`), RPC
protocol (`packages/vite-plugin/src/rpc/protocol.ts` — already typed on `ViewChange`), and any
drift/auto-apply logic in `packages/core/src/manual-layout` (AGENTS.md: view-related changes
must update drift detection — **ask owner if unsure what counts as drift**).

### 2. Canvas event capture (packages/diagram)

- Enable on xyflow (only when editing is enabled and the editor port is not a stub):
  - `onConnect` → `add-relation` (or `add-dynamic-step` in dynamic views).
  - Palette (kinds from `specification`, D10) with `onDrop` → `add-element` /
    `add-deployment-node` / `add-instance`, carrying drop coordinates (D12) and the container
    under the cursor as parent (D4).
  - Double-click title → `change-title`.
  - `Del` → `exclude-from-view`; context-menu "Delete from model" → `delete-from-model`
    (confirmation dialog, D6).
- Every gesture raises `change.view` on the existing editor actor; `pushToSyncQueue` /
  `state.sync-queue.ts` handle serialisation. Ghost state (D11) lives in the editor actor
  context, cleared on `view.synched` or on failure.
- Respect layering in AGENTS.md: editor stays orthogonal to `likec4diagram/`; no
  `likec4:*` imports or language-server calls from `packages/diagram`.

### 3. Safe AST mutation (packages/language-server/src/model-change)

One handler file per op, following `changeElementStyle.ts`:

1. Locate target via `ModelLocator` / `FqnIndex` and its `$cstNode`.
2. Compute insertion anchor + indentation from CST (mirror the closing-brace handling).
3. Emit minimal `TextEdit[]` — never regenerate the file.
4. Validate inputs before emitting: identifier matches grammar, no FQN collision in `FqnIndex`,
   kind exists in specification, source/target resolve.
5. **Post-apply guard**: after `DocumentBuilder.update`, if the document gained new parse/
   linking errors or the expected FQN is missing, revert (apply inverse edits) and return
   `{ success: false, error }`.
6. Dispatch in `LikeC4ModelChanges.convertToTextEdit` (and its `applyChange` switch), keeping
   `nonexhaustive(change)`.

Composite changes (model edit + auto-include + snapshot merge) are produced in **one**
`applyChange` call and applied as a single multi-file `WorkspaceEdit` so VSCode treats them as
one atomic, undoable edit. `applyTextEdits` currently takes a single doc — generalise it to
`Map<uri, TextEdit[]>`.

### 4. Synchronisation

- `.c4` files are the single source of truth; UI only sends intents and re-renders from the
  recomputed model.
- Optimistic concurrency: each op carries the document `version` it was computed against;
  `applyChange` rejects when the version changed (file edited elsewhere in between).
- Dev server: record inverse TextEdits of each successful op in a per-session stack for undo/
  redo (D13). VSCode: rely on native undo (`applyEdit`).

### 5. Phase 2 — rename / move

- Re-enable and fix `LikeC4RenameProvider` to be FQN-aware across: relations, view predicates/
  `include`/`exclude`/`style` targets, `extend` blocks, `instanceOf`, dynamic steps, imports.
- Build `rename-element` on top of it; `move-element` = cut/paste the element block into the
  new parent (D4 rules) + same reference rewrite.
- Manual-layout snapshots reference element ids — rename/move must also rewrite affected
  `.likec4/*` snapshots (verify against drift logic).

## Delivery plan

**Phase 1** (each step independently shippable, end-to-end in both hosts):

1. Infra: generalise `applyTextEdits` to multi-file; add version check; add post-apply parse
   guard; add the in-memory undo stack for the dev server.
2. `add-relation` end-to-end (element views) — prototype that validates the whole pipeline,
   including ghost UI and auto-include.
3. `add-element` + palette + D12 snapshot merge.
4. `change-title`, `exclude-from-view`, `delete-from-model` (with reference check).
5. Deployment views: `add-deployment-node`, `add-instance`.
6. Dynamic views: `add-dynamic-step` (ordering).

**Phase 2**: fix rename provider → `rename-element` → `move-element`.

Before editing any symbol, run gitnexus impact (repo name `likec4`) at least on: `ViewChange`,
`LikeC4EditorCallbacks`, `LikeC4ModelChanges`, `applyTextEdits`, `pushToSyncQueue`.

## Testing

- Per handler: Vitest snapshot specs "DSL before → op → DSL after" next to the handler, like
  `changeElementStyle.spec.ts`. Cover: comments preserved, nested vs top-level, `}` on same
  line, tabs vs spaces, multiple files, collisions, unknown kind, referenced-element delete
  refusal.
- Round-trip: apply op, re-parse via `fromSource`, assert model contains the new element/
  relation and no new diagnostics.
- Editor actor: extend `state.sync-queue.spec.ts` for new ops and ghost lifecycle.
- e2e (later): Playwright in `e2e/` for connect + drop in the dev server.

## Open questions (not yet decided)

- **Q1 — where does a new relation go?** Options: inside the source element's block
  (`-> target`), or at the `model {}` level of the source's file, or of the view's file.
  Recommendation: inside the source element's block (mirrors D4).
- **Q2 — naming of new elements**: auto-generate identifier from title (slug) vs. prompt.
- **Q3 — dynamic step insertion order** when connecting: append vs. after the selected step.
- **Q4 — relation kinds/technology**: popover after connect, or edit later.

## Tooling notes for the next agent

- Local indexes exist and are git-excluded via `.git/info/exclude` (not committed):
  - codebase-memory-mcp project: `home-jilles-git-likec4`
  - gitnexus repo: `likec4` (`.gitnexus/`). **Re-index with `gitnexus analyze --index-only`** —
    plain `analyze` injects blocks into `AGENTS.md`/`CLAUDE.md` and copies skills into
    `.agents/skills` / `.claude/skills`, which violates repo policy (root `CLAUDE.md` must be
    exactly `@AGENTS.md`; skills must be symlinks).
  - graphify graph: `packages/graphify-out/graph.json` (AST-only, `graphify update packages`).
