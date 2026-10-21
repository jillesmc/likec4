---
status: completed
title: 'Task 04: Rename across projects that import the element'
type: backend
complexity: medium
---

# Task 04: Rename across projects that import the element

## Overview

A renamed top-level element may be imported by other projects of the workspace
(`import { x } from 'p'`). Their import and their references follow the rename (owner Q5).

## Shippable Outcome

- Outcome: renaming an imported element rewrites the `import` statements and the importing
  projects' references; the guard covers those projects; snapshots of their views follow.
- Verify in this task: the spec below.
- Integration verification: none.

## Requirements

- `_spec.md` rule 13; `_user_stories.md` US-007 AC-1; ADR-001 (`Imported` nodes).
- References in the importing project point to the `Imported` node, not to the element: the
  planner must find them through the `Imported` nodes that import it.

## Subtasks

- [x] 4.1 Server: `planRename` follows `Imported` nodes; guard and snapshot rewrite cover the
      importing projects.

## Implementation Details

### Relevant Files

- `packages/language-server/src/like-c4.langium:99-105` — imports.
- `packages/language-server/src/references/scope-provider.ts` (`isImported` branches).
- `packages/language-server/src/validation/imports.ts`.
- `packages/language-server/src/model-change/_references.ts`, `_guard.ts`.

## Tests

- [x] UT-030 — import and importing references renamed (multi-project fixture)

## Completion Notes (2026-10-20)

- Planner: a reference to the renamed element found in an `import` (`ast.Imported`) is renamed, and
  the references to that import in the importing project are renamed too (they spell the old name).
  Nested elements need nothing more: `cloud.api` in the importing project already references the
  element of the other project for its `api` segment.
- Guard: keys carry the project of the target (two projects may have the same local FQN); renames
  apply to the project of the change only. The guard covers every project owning an edited file.
- Snapshots: views of the importing projects are rewritten with the global ids
  (`@projectA.cloud` → `@projectA.platform`); history entries record the project of each snapshot.
- Known limit (ponytail comment in `_references.ts`): an unnamed instance of the imported element
  in the importing project is not followed; the guard refuses such a rename instead of breaking it.
- Verification: UT-030 failed before (`invalid-result`), passes after; language-server 955 passed;
  `pnpm typecheck` 26/26; oxlint clean on the changed files.
