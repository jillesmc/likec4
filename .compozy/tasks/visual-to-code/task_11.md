---
status: pending
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

- [ ] 11.1 Core: widen `ChangeTitle.target`.
- [ ] 11.2 Server: relation branch in `changeTitle.ts` (find the relation AST like
  `deleteFromModel.ts` `findRelation`).
- [ ] 11.3 Diagram: double-click on the edge label in `RelationshipEdge.tsx` → inline editor
  (reuse `useTitleEditing`).

## Implementation Details

### Relevant Files

- `packages/language-server/src/model-change/changeTitle.ts`, `changeTitle.spec.ts`.
- `packages/language-server/src/model-change/deleteFromModel.ts` — `findRelation` to share.
- `packages/diagram/src/likec4diagram/custom/edges/RelationshipEdge.tsx`,
  `packages/diagram/src/editor-ui/useTitleEditing.tsx`.

## Tests

- [ ] UT-220, UT-221, UT-222, UT-223 — replace, insert, property, remove
- [ ] UT-224 — `read-only-target`, `not-found`
- [ ] UT-225 — editor offered only for single-relation edges
