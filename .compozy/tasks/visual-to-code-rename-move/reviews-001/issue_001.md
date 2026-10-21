---
provider: manual
pr:
round: 1
round_created_at: 2026-10-21T20:27:26Z
status: pending
file: packages/language-server/src/model-change/moveElement.ts
line: 165
severity: medium
author: claude-code
provider_ref:
---

# Issue 001: Move is refused when the element has children declared in an extend

## Review Comment

`moveElement` rewrites the references to the moved subtree, but it collects that subtree with
`AstUtils.streamAst(node).filter(ast.isElement)`: only the children written inside the element's own
block. Children declared elsewhere with `extend cloud.db { table = system }` also change their FQN
(`cloud.db.table` → `billing.db.table`), but their references are not rewritten, so the move is
always reverted.

Verified with a throwaway spec: `model.c4` defines `cloud = system { db = system }` and
`billing = system`; `extra.c4` has `extend cloud.db { table = system }` and
`billing -> cloud.db.table`. `move-element cloud.db → billing` returns
`invalid-result` ("Could not resolve reference to Referenceable named 'db'"), and nothing is written.
The refusal is safe, but `_spec.md` rule 6 promises that references to the element "or one of its
descendants" are rewritten, and US-003 has no exception for extended children.

Suggested fix: build the subtree from the FQN index (every element whose FQN is the moved FQN or
starts with `<fqn>.`, e.g. `FqnIndex.byFqn` / descendants of the project) instead of the AST of the
definition, and rewrite the `extend` paths (`StrictFqnElementRef` chains) and other chains to those
elements like the ones inside the block. Add a moveElement spec row with a child declared in an
`extend` in another file.

## Triage

- Decision: `UNREVIEWED`
- Notes:
