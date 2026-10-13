---
status: completed
title: "Task 1: Model-change pipeline and add-relation over LSP/RPC"
type: backend
complexity: high
---

# Task 1: Model-change pipeline and add-relation over LSP/RPC

## Overview

An integrator (or the canvas, in task 02) can send `{ op: 'add-relation', source, target }` to
`likec4/change-view` or the vite RPC `updateView`. The relation is written as a minimal,
validated edit in the right file, and an `include` is added only when the view would otherwise
hide it. This task builds the shared server pipeline that every later op reuses: multi-file edits,
preconditions, visibility prediction, post-apply guard, error codes, and per-project
serialisation.

## Shippable Outcome

- Outcome: `ChangeView` with an `add-relation` op writes `-> target` inside the source block
  (ADR-001), plus `include` when needed, in one edit. Invalid or stale requests return
  `{ success:false, code, error }` and leave the files byte-identical.
- Verify in this task: the handler and `ModelChanges` specs listed under Tests (memfs harness),
  covering both the FS branch and a faked LSP `applyEdit`.
- Integration verification: none (the canvas connect journey is verified in task 02).

## Requirements

- Contracts: `_spec.md` Part II → Core Interfaces (`AddRelation`, `ViewChangeErrorCode`,
  `ModelChangePlan`), Business Rules 2, 4, 7, 11, 12, and Safety Invariants 1, 2, 4.
- Never use `writeDSL` / `toDSL`. Edits are CST-anchored `TextEdit`s only.
- Visibility prediction runs core `computeView` over the parsed model data patched in memory with
  the new relation (Key Decisions). It must not write files.
- `applyTextEdits(doc, edits)` is replaced by `applyWorkspaceEdits(Map<uri, TextEdit[]>)`. With an
  LSP connection that is **one** `workspace.applyEdit`; without one, per-file
  `TextDocument.applyEdits` + `writeFile`, then a single `DocumentBuilder.update(uris)`.
- Guard: if any touched document gains error-severity diagnostics, apply the inverse edits and
  return `invalid-result` with the first diagnostic's message.
- The failure branch of `ChangeView.Res` gains `code?: ViewChangeErrorCode` (additive).
  `vite-plugin/rpc/functions/updateView.ts` throws `Error('[<code>] <message>')`.
- Existing ops (`change-element-style`, `change-autolayout`, `change-property`, snapshot ops) keep
  their exact behaviour.
- Before editing, run gitnexus impact on `ViewChange`, `LikeC4ModelChanges` and `applyTextEdits`
  (confirm `applyChange` callers with grep; graph indexers under-report them).
- After changing core types: `pnpm exec tsc --build`.

## Subtasks

- [x] 1.1 Add `ViewChange.AddRelation` and `ViewChangeErrorCode` to core; extend the `ChangeView.Res`
  failure branch with `code`.
- [x] 1.2 Extract `model-change/_anchors.ts` (indent detection, EOL, closing-brace handling, body
  creation, `model {}` creation) from `changeElementStyle.ts`.
- [x] 1.3 Implement `model-change/addRelation.ts` returning a `ModelChangePlan`.
- [x] 1.4 Implement `model-change/_visibility.ts` (predict + build the include edit).
- [x] 1.5 Rework `ModelChanges.applyChange`: preconditions → plan → visibility →
  `applyWorkspaceEdits` → guard/revert, with a per-project promise chain and error codes.
- [x] 1.6 Make `updateView` throw with the `[code]` prefix.

## Implementation Details

See `_spec.md` → System Architecture and Implementation Design.

### Relevant Files

- `packages/core/src/types/view-changes.ts` — the union to extend.
- `packages/language-server/src/protocol.ts:286-303` — `ChangeView` types.
- `packages/language-server/src/model-change/ModelChanges.ts:23-230` — dispatch, `applyTextEdits`.
- `packages/language-server/src/model-change/changeElementStyle.ts` — the anchor pattern to extract.
- `packages/language-server/src/model-change/changeElementStyle.spec.ts:1-60` — test harness.
- `packages/language-server/src/model/model-locator.ts:116-200` — `locateElement`, `locateViewAst`.
- `packages/language-server/src/like-c4.langium:114-160,245-275` — element body and relation
  syntax.
- `packages/core/src/compute-view/index.ts` — `computeView`.
- `packages/vite-plugin/src/rpc/functions/updateView.ts` — error message format.

### Dependent Files

- `packages/vscode/src/useRpc.ts:127-139`, `packages/vscode/src/panel/activateMessenger.ts:128-150`
  — consume `ChangeView.Res`; there are no changes beyond passing `code` through.
- `apps/playground/src/monaco/LanguageClientSync.tsx:218-232` — unaffected (non-goal).

### Related ADRs

- [ADR-001](adrs/adr-001.md) — relation placement.
- [ADR-002](adrs/adr-002.md) — preconditions instead of version tokens.

## Deliverables

- Core types, the `_anchors.ts`, `_visibility.ts` and `addRelation.ts` modules, the reworked
  `ModelChanges`, and the RPC error format.

## Tests

- [x] UT-001, UT-002, UT-003, UT-004, UT-005, UT-006 — CST anchors
- [x] UT-010, UT-011, UT-012 — add-relation placement
- [x] UT-030, UT-031 — visibility prediction
- [x] UT-040 — stale target → `not-found`
- [x] IT-001, IT-002, IT-003, IT-004, IT-005 — applyChange end-to-end (FS, LSP, include, guard,
  apply-failed)
- [x] IT-008 — per-project serialisation
- [x] IT-010 — vite `updateView` error prefix
- [x] Existing `changeElementStyle.spec.ts` and `viewChange.spec.ts` stay green

## Success Criteria

- `pnpm typecheck` and `pnpm test --no-typecheck` pass for `core`, `language-server` and
  `vite-plugin`.

## Completion Notes (2026-10-12)

- `_anchors.ts` was written as a new module (indentation and EOL detection, same-line `}`, body and
  top-level block creation). `changeElementStyle.ts` was **not** refactored onto it, to keep the
  upstream rebase surface small. Its existing behaviour and specs are unchanged.
- `ModelChangePlan` has no `expect` field. The guard checks only for new errors, and `_spec.md`
  Core Interfaces and Known Risks were updated to match.
- `appendToBlock` replaces the whitespace before a same-line `}`, so the brace keeps the owner's
  indentation (found by UT-006).
- UT-011: with `include *`, an imported source's relation is already visible, so no `include` is
  added. The spec asserts the computed edge.
- IT-010 is a boundary test of `updateView` with a faked `likec4.editor`
  (`packages/vite-plugin/src/rpc/functions/updateView.spec.ts`).
- Shared test harness for later tasks: `packages/language-server/src/model-change/__test__/memfsWorkspace.ts`
  (memfs, multi-file, optional fake LSP connection).
- Verification: `pnpm typecheck` green (26 tasks). Package suites: core 1157 passed,
  language-server 860 passed, vite-plugin 38 passed + 1 failure in `src/ai/detect-ai.spec.ts`
  (MiniMax), which fails identically without these changes. oxlint is clean on the changed files,
  and dprint was applied.
- No changeset was created (internal fork; decide at delivery).
