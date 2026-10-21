---
status: completed
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

- [x] 7.1 Server: `LikeC4RenameProvider` (`prepareRename`, `rename`) delegating to `planRename`.
- [x] 7.2 Server: bindings in `module.ts` and the export in `lsp/index.ts`.

## Implementation Details

### Relevant Files

- `packages/language-server/src/lsp/RenameProvider.ts`, `lsp/index.ts`.
- `packages/language-server/src/module.ts:146,210`.
- `packages/language-server/src/model-change/_references.ts`.

## Tests

- [x] UT-050, UT-051, UT-052, UT-053

## Completion Notes (2026-10-21)

- Langium's `DefaultRenameProvider` was active (the binding in `module.ts` only commented out the
  LikeC4 override): F2 in the `.c4` editor already offered a rename that rewrote `this`/`it` and
  knew nothing about FQNs. It is now replaced by `LikeC4RenameProvider`.
- `prepareRename`: the leaf at the cursor (`CstUtils.findDeclarationNodeAtOffset`) is resolved with
  `References.findDeclarations`; only elements, deployment nodes and instances, and only when the
  leaf spells their name (`this`/`it` refused). `rename` reuses the canvas handler `renameElement`
  (same planner and preconditions) and returns its edits as one `WorkspaceEdit`; a
  `ModelChangeError` becomes a `ResponseError` with the same message.
- Verification: `lsp/RenameProvider.spec.ts` (UT-050 – UT-053) 4 passed; language-server 969
  passed; `pnpm typecheck` 26/26. F2 in Code - OSS is recorded by task 08.
