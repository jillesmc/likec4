---
status: completed
title: "Task 11: Edit a relation title in place"
type: feature
complexity: medium
---

# Task 11: Edit a relation title in place

## Overview

Double-clicking a relation label (or an unlabeled edge) opens an inline title editor, and the
relation's title is written to the source. Owner decision Q6, 2026-10-18.

## Shippable Outcome

- Outcome: `ViewChange.ChangeTitle.target` also accepts `{ relation: RelationId }`. The server
  replaces the positional title or `title` property, inserts the title after the target reference
  when absent, and removes it on an empty title. The edge label opens the S5 inline editor.
- Verify in this task: the specs below, plus a manual check in `likec4 start`.
- Integration verification: none.

## Requirements

- `_spec.md` Business Rule 10; `_uiux.md` S11; `_dx.md` `relTitle` snippet; `_user_stories.md`
  US-014.
- Only edges backed by exactly one relation defined in this project offer the editor; the server
  answers `read-only-target` for other projects and `not-found` for unknown ids.
- Element-view edges only; step titles in dynamic views are a non-goal.
- Same title → no write (existing no-op rule).

## Subtasks

- [x] 11.1 Core: widen `ChangeTitle.target`.
- [x] 11.2 Server: relation branch in `changeTitle.ts` (find the relation AST like
  `deleteFromModel.ts` `findRelation`).
- [x] 11.3 Diagram: double-click on the edge label in `RelationshipEdge.tsx` → inline editor
  (reuse `useTitleEditing`).

## Implementation Details

### Relevant Files

- `packages/language-server/src/model-change/changeTitle.ts`, `changeTitle.spec.ts`.
- `packages/language-server/src/model-change/deleteFromModel.ts` — `findRelation` to share.
- `packages/diagram/src/likec4diagram/custom/edges/RelationshipEdge.tsx`,
  `packages/diagram/src/editor-ui/useTitleEditing.tsx`.

## Tests

- [x] UT-220, UT-221, UT-222, UT-223 — replace, insert, property, remove
- [x] UT-224 — `read-only-target`, `not-found`
- [x] UT-225 — editor offered only for single-relation edges

## Completion Notes (2026-10-18)

- Core: `ChangeTitle.target` also accepts `{ relation: RelationId }`.
- Server (`changeTitle.ts`): relation branch replaces the positional title or the `title` body
  property, inserts the title right after the target (before tags/body), and removes it on an empty
  title. When a positional description follows, the title becomes `''` (removing it would turn the
  description into the title). `findRelation` moved from `deleteFromModel.ts` to `_lookup.ts`.
- Decision: relations of other projects are not imported into a project's model (checked with a
  multi-project workspace), so no canvas edge can target one. The `read-only-target` branch was
  unreachable and was dropped; an unknown id is `not-found`. UT-224 covers `not-found`.
- Diagram: double-click on an edge of a single relation, in element views, opens the inline title
  editor at the pointer (`relationTitleTargetOf`, `useTitleEditing.editRelationTitle`); other edges
  keep the existing double-click behaviour. `TitlePrompt` accepts an empty value with `allowEmpty`.
- E2E: new US-014 scenario (connect with a title, double-click the label, retitle). E2E-004 now waits
  for the restored fixture, and US-014 ends after the view shows the new label: a fixture restore right
  after a server write was missed by the file watcher, so the next test saw a stale model.
- Verification: language-server 923 passed; diagram 217 passed; `pnpm typecheck` 26/26; dev-server
  E2E 16 passed (twice); static-build E2E 2 passed.

