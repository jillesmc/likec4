# Developer Experience: Visual-to-code editing, phase 2 (rename and move)

Public-surface contract. Companion to `_spec.md` (Part II) and `_tests.md`. The surfaces are the
phase-1 ones (`ViewChange`, `likec4/change-view`, vite RPC `updateView`, `LikeC4EditorCallbacks`)
plus the standard LSP rename requests. No CLI, no config key.

## Golden Path

With the fixture of `_user_stories.md`, an integrator renames `cloud.api`:

```ts
await rpc.updateView({
  projectId: 'default',
  viewId: 'index',
  change: { op: 'rename-element', target: { element: 'cloud.api' }, name: 'gateway' },
})
```

Result: `api = container` → `gateway = container`; `-> cloud.api` → `-> cloud.gateway`; view rules
rewritten; snapshots keep the node. Then a move:

```ts
await rpc.updateView({
  projectId: 'default',
  viewId: 'index',
  change: { op: 'move-element', element: 'cloud.db', parent: 'customer' },
})
```

## Ops

| Op               | Payload                                                                     | Effect                                                     |
| ---------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `rename-element` | `target: { element: Fqn } \| { deployment: DeploymentFqn }`, `name: string` | Renames the definition and every reference (rules 2–4, 13) |
| `move-element`   | `element: Fqn`, `parent: Fqn \| null` (`null` = top level)                  | Moves the statement and rewrites references (rules 5–7)    |

Both are view-scoped like every `ViewChange` (`viewId` is used for the top-level placement and the
visibility include).

## Results

- Success: phase-1 shape (`{ success: true, location }`) plus `viewId?: ViewId` when the current
  view's id changed (an unnamed `view of x`).
- `LikeC4EditorCallbacks.handleChange` may resolve with `{ viewId?: ViewId }`; the diagram then
  navigates to it.

## Errors

| Code               | When                                                                  | Message (verbatim, `<…>` filled)                    |
| ------------------ | --------------------------------------------------------------------- | --------------------------------------------------- |
| `not-found`        | target or parent does not exist                                       | `<fqn> not found`                                   |
| `invalid-name`     | name does not match the grammar `Id`                                  | `<name> is not a valid identifier`                  |
| `name-collision`   | a sibling (in the new parent, for a move) has the name                | `<parent or "Top level"> already has <name>`        |
| `read-only-target` | the item is defined in another project                                | `<fqn> is defined in another project`               |
| `invalid-parent`   | move into its own subtree, to its current parent, or to a non-element | `<fqn> cannot be moved into <parent>`               |
| `has-references`   | move of a top-level element imported by another project               | `<fqn> is imported in <n> place(s): <file:line, …>` |
| `invalid-result`   | resolution guard or new errors (rule 8)                               | `The change would break <file:line>`                |
| `stale-undo`       | phase 1, now covering snapshots too                                   | phase-1 message                                     |

## LSP rename

- `textDocument/prepareRename`: returns the range of the name under the cursor when it is the
  definition or a reference of an element, deployment node or instance; otherwise an error
  `The element can't be renamed.`
- `textDocument/rename`: returns one `WorkspaceEdit` with the `.c4` edits of the planner. No
  snapshot edits, no guard (ADR-003). An invalid name returns an error with the `invalid-name`
  message.
