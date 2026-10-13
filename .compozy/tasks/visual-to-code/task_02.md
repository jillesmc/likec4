---
status: completed
title: "Task 2: Connect on canvas with ghost feedback in both hosts"
type: feature
complexity: high
---

# Task 2: Connect on canvas with ghost feedback in both hosts

## Overview

An architect drags from element A to element B in an element view, in `likec4 start` or the
VSCode preview, and sees a dashed edge that becomes real once the sources are updated. A rejected
gesture removes the ghost and shows a toast. Together with task 01, this solves the Motivating
Problem.

## Shippable Outcome

- Outcome: `onConnect` on an element view raises `change.view` with `add-relation`. The ghost edge
  renders until `view.synched`. A port rejection removes it and shows the `_dx.md` §Errors message.
- Verify in this task: editor-actor specs, plus E2E-001 against `likec4 start` on the
  golden-path fixture. Manually check the VSCode preview (US-001 AC-2: dirty buffer, text undo)
  with the `vscode-extension-screenshot-evidence` skill.
- Integration verification: none.

## Requirements

- `_uiux.md` S1, S2, S9. `_spec.md` Architectural Boundaries: no `likec4:*` or language-server
  imports in `packages/diagram`. New UI goes in `src/editor-ui/`, and ghost state lives in the
  `editor` actor.
- Handles and `nodesConnectable` exist only when `!enableReadOnly && !isStub`
  (Safety Invariant 5).
- Failure detection reuses `executeChange`'s `requested − applied`
  (`useEditorActorLogic.ts:39-61`). Do not add a new result type.
- `packages/vscode-preview/src/state.ts` `handleChange` must throw when
  `ExtensionApi.change` returns `success:false`. Document the reject-on-failure contract in the
  `LikeC4EditorCallbacks.handleChange` JSDoc.
- `pushToSyncQueue` must not dedupe two distinct add-relation changes.
- Dynamic views: `onConnect` is not wired here (task 08).
- Run gitnexus impact on `LikeC4EditorCallbacks` and `pushToSyncQueue` before editing.

## Subtasks

- [x] 2.1 Add `ghosts` to the editor actor context; add them on `change.view` for creation ops,
  clear them on `view.synched`, and remove them plus notify on failure.
- [x] 2.2 Wire xyflow `onConnect` / `nodesConnectable` and the handles in `DiagramXYFlow.tsx`,
  gated as required.
- [x] 2.3 Render ghost edges (dashed, dimmed) through the existing edge components with a
  `pending` flag.
- [x] 2.4 VSCode preview: throw on failure.
- [x] 2.5 Create the E2E fixture `e2e/fixtures/visual-to-code/` (the `_dx.md` golden-path project)
  and `e2e/playwright.dev-server.config.ts` running `likec4 start` on it, restoring the fixture
  before each test.

## Implementation Details

### Relevant Files

- `packages/diagram/src/likec4diagram/DiagramXYFlow.tsx:270-300` — xyflow handlers.
- `packages/diagram/src/editor/actor/types.ts`, `actions.ts:218-262`, `state.sync-queue.ts` — events,
  queue.
- `packages/diagram/src/editor/useEditorActorLogic.ts:39-61` — `executeChange`.
- `packages/diagram/src/editor/LikeC4EditorCallbacks.tsx` — port JSDoc.
- `packages/vscode-preview/src/state.ts:227-250` — VSCode port.
- `packages/likec4-spa/src/pages/ViewEditor.tsx:48-70` — SPA port (already throws).
- `e2e/playwright.static-build.config.ts` — pattern for a webServer config.

### Related ADRs

- [ADR-002](adrs/adr-002.md) — why there is no version token on the client.

## Deliverables

- Connect gesture, ghost lifecycle, failure toast, VSCode throw, and the dev-server E2E harness and
  fixture.

## Tests

- [x] UT-060 — no op on self/empty connect
- [x] UT-061 — two connects in order, not deduped
- [x] UT-065, UT-066 — ghost confirmed / rejected
- [x] E2E-001 — connect journey in `likec4 start`
- [x] Existing `state.sync-queue.spec.ts` and `e2e/tests/manual-layout-views.spec.ts` stay green

## Success Criteria

- The VSCode manual check shows a dirty `.c4` buffer containing `-> <target>`, and Undo in that
  editor removes it. Evidence is attached to the task.

## Progress Notes (2026-10-13)

Status `completed`. The manual VSCode check was done by the owner in Code - OSS 1.138, with the
extension run from the repo (`code --extensionDevelopmentPath=packages/vscode`):
- `evidence/task_02/vscode-connect-applied.png`: after connecting customer → cloud, `-> cloud` was
  inserted inside `customer`'s block and the edge is rendered in the preview.
- `evidence/task_02/vscode-undo.png`: Ctrl+Z in the text editor removes the line, and the edge
  disappears from the preview.

- Connect gesture: `onConnectEnd` in `DiagramXYFlow.tsx`. When released outside a handle, the target is
  the innermost node under the pointer (`screenToFlowPosition` + `getIntersectingNodes`). xyflow
  reports `connection.to` in container coordinates, not flow coordinates.
- Visible source handle: a dot on the **right edge** of the node, on hover (`globalCss.ts`). The
  bottom-center position is covered by the node action buttons.
- Fix found by E2E: `DefaultHandles` always let a connection start (xyflow `isConnectableStart`
  defaults to true). It now follows the store's `nodesConnectable`, so read-only diagrams cannot
  start connections.
- The SPA editor starts **read-only** (lock toggle). Connecting requires unlocking first; E2E-001
  does this.
- `change.view` events received while the sync queue is processing used to be dropped. They are
  now queued (UT-061 fails without the fix).
- `ExecuteChange.Output` gained `failed: { change, error }[]`, used for the toast message.
- New: `packages/diagram/src/editor-ui/` (`connect.ts`, `GhostEdges.tsx`,
  `EditorErrorNotification.tsx`), `useEditorActorContext` hook.
- E2E harness: `e2e/playwright.dev-server.config.ts` (`pnpm test:dev-server`), fixture
  `e2e/fixtures/visual-to-code/`, helper `e2e/helpers/visual-to-code.ts`. Running it needs the
  packed tarballs: `pnpm pretest:e2e` does not pack config, generators, language-server,
  language-services, layouts, log or style-preset, which the e2e overrides need.
- Verification: diagram 169 tests passed; `pnpm typecheck` passed (26 tasks); E2E-001 passed 3/3;
  `e2e/tests/manual-layout-views.spec.ts` passed; oxlint is clean on the changed files.
- Follow-up found (packages/vscode, not in this task): after a change, the extension saves only
  `location.uri` (`activateMessenger.ts`). When the edit also adds an `include` in the view file,
  that second file stays modified but unsaved.
- Side effect to watch: `turbo` injects a block into `AGENTS.md` and `likec4ops prepack` rewrites
  several `.gitignore` files. Both were reverted. Consider `"agentGuidance": false` in `turbo.json`.
