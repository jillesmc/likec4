---
status: pending
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

- [ ] 4.1 Server: `planRename` follows `Imported` nodes; guard and snapshot rewrite cover the
      importing projects.

## Implementation Details

### Relevant Files

- `packages/language-server/src/like-c4.langium:99-105` — imports.
- `packages/language-server/src/references/scope-provider.ts` (`isImported` branches).
- `packages/language-server/src/validation/imports.ts`.
- `packages/language-server/src/model-change/_references.ts`, `_guard.ts`.

## Tests

- [ ] UT-030 — import and importing references renamed (multi-project fixture)
