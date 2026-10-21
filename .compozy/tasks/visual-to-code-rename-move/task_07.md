---
status: pending
title: 'Task 07: F2 rename in the .c4 editor'
type: backend
complexity: medium
---

# Task 07: F2 rename in the .c4 editor

## Overview

Re-enable `LikeC4RenameProvider` on top of the planner so F2 in the `.c4` editor renames elements,
deployment nodes and instances correctly (owner Q3).

## Shippable Outcome

- Outcome: `textDocument/prepareRename` answers the name range for elements, deployment nodes and
  instances (definition or reference) and refuses other symbols; `textDocument/rename` returns the
  planner's `.c4` edits as one `WorkspaceEdit`.
- Verify in this task: the specs below; F2 in Code - OSS (task 08 records the evidence).
- Integration verification: none.

## Requirements

- `_spec.md` rule 12; ADR-003; `_dx.md` LSP rename; `_user_stories.md` US-006.
- No guard, no snapshot rewrite, no history entry.

## Subtasks

- [ ] 7.1 Server: `LikeC4RenameProvider` (`prepareRename`, `rename`) delegating to `planRename`.
- [ ] 7.2 Server: bindings in `module.ts` and the export in `lsp/index.ts`.

## Implementation Details

### Relevant Files

- `packages/language-server/src/lsp/RenameProvider.ts`, `lsp/index.ts`.
- `packages/language-server/src/module.ts:146,210`.
- `packages/language-server/src/model-change/_references.ts`.

## Tests

- [ ] UT-050, UT-051, UT-052, UT-053
