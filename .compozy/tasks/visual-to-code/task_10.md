---
status: completed
title: "Task 10: Connect popover with relation kind and technology"
type: feature
complexity: medium
---

# Task 10: Connect popover with relation kind and technology

## Overview

Connecting two elements in an element view opens a popover with title, kind and technology, all
optional. Owner decision Q4, 2026-10-18.

## Shippable Outcome

- Outcome: `ViewChange.AddRelation` gains `kind?` and `technology?`. The server writes
  `-[kind]-> target 'title'` and the technology as a `technology '…'` body property, and rejects
  undeclared kinds with `unknown-kind`. The connect popover offers `none` + declared relationship
  kinds and a technology input.
- Verify in this task: the specs below, plus E2E-007.
- Integration verification: none.

## Requirements

- `_spec.md` Business Rule 16, Core Interfaces amendment; `_uiux.md` S10 (element views);
  `_dx.md` `typed` snippet; `_user_stories.md` US-013.
- Enter with empty fields keeps today's plain `-> target`. Esc cancels and removes the ghost.
- The popover component is shared with dynamic views in task 12; keep the view-specific fields
  behind a prop, not two components.
- The visibility prediction (`_visibility.ts`) is unaffected by kind/technology.
- E2E fixture: declare one relationship kind in `e2e/fixtures/visual-to-code/model.c4`.

## Subtasks

- [x] 10.1 Core: `kind?`, `technology?` on `AddRelation`.
- [x] 10.2 Server: `addRelation.ts` connector and body; `unknown-kind` precondition.
- [x] 10.3 Diagram: connect popover (reusing the `TitlePrompt` form from task 9) wired in the
  connect flow.
- [x] 10.4 E2E: E2E-007.

## Implementation Details

### Relevant Files

- `packages/language-server/src/like-c4.langium:245-285` — `Relation`, `RelationConnector`,
  `RelationBody`, `RelationStringProperty`.
- `packages/language-server/src/model-change/addRelation.ts`, `addRelation.spec.ts`.
- `packages/diagram/src/editor-ui/connect.ts`, `connect.spec.ts`, `TitlePrompt.tsx`.

## Tests

- [x] UT-210, UT-211, UT-212 — DSL written, `unknown-kind`
- [x] UT-213, UT-214 — popover fields, empty Enter, Esc
- [x] E2E-007 — kind and technology written

## Completion Notes (2026-10-18)

- Core: `AddRelation.kind?` / `technology?`.
- Server (`addRelation.ts`): `-[kind]-> target 'title'`, technology as a `technology '…'` body
  property (indentation from the file); undeclared kinds → `unknown-kind`. Same for the fallback in
  the view's `model {}` (source in another project).
- Diagram: `editor-ui/ConnectPrompt.tsx` (`ConnectPrompt`, `connectChange`, `useConnectPrompt`) opens
  at the release point after a connect in element views; kinds come from
  `relationshipKinds(model)` (`palette.ts`). Enter with empty fields keeps the plain `-> target`, Esc
  writes nothing. Dynamic views still add the step directly; task 12 adds title and position there,
  reusing the same component.
- E2E fixture declares `relationship async`; element-view connect scenarios now press Enter in the
  prompt.
- Verification: language-server 918 passed; diagram 215 passed; `pnpm typecheck` 26/26; dev-server
  E2E 15 passed (new E2E-007); static-build E2E 2 passed.

