# Test Specification: Visual-to-code editing, phase 2 (rename and move)

Canonical test contract. Companion to `_spec.md`, derived from `_user_stories.md`, `_dx.md` and
`_uiux.md`.

## Strategy

- **Frameworks**: Vitest; Playwright (`e2e/`) against `likec4 start` for browser journeys.
- **Planner / handler cases**: phase-1 harness (memfs, `createTestServices` + `WithFileSystem()`,
  `stripIndent` fixtures), asserting the full resulting text of every touched file with inline
  snapshots. Reference kinds are table-driven (`it.each`).
- **Integration cases**: `LikeC4ModelChanges.applyChange` end-to-end without an LSP connection (FS
  branch) and with a faked `applyEdit`, as in phase 1.
- **Editor cases**: editor-UI specs (`@testing-library/react`) and the sync-queue spec with a fake
  port.
- **E2E**: the phase-1 fixture project, extended with a second file and a manual-layout view.
- **VSCode**: manual pass in Code - OSS (no automated extension tests), recorded as evidence.
- **Execution**: `pnpm test --no-typecheck`; `pnpm test:e2e`.

## Coverage Matrix

| Source                    | Behavior                                                   | Unit           | Integration    | E2E             |
| ------------------------- | ---------------------------------------------------------- | -------------- | -------------- | --------------- |
| US-001 AC-3, rule 3       | definition and every reference kind renamed, rest intact   | UT-001–UT-009  | IT-001         | E2E-001         |
| US-001 AC-6               | `this` / `it` untouched                                    | UT-010         | —              | —               |
| US-001 EC-4, US-002 AC-2  | unnamed instances follow / get a name                      | UT-011, UT-012 | —              | —               |
| US-001 AC-4, rule 9       | snapshots rewritten, no drift                              | UT-040, UT-041 | IT-002         | E2E-001         |
| US-001 EC-5, rule 10      | unnamed view id change: snapshot moved, result `viewId`    | UT-042         | IT-003         | —               |
| US-001 EC-1, rule 4       | same name no-op; invalid / taken names                     | UT-013–UT-015  | —              | —               |
| US-001 AC-1/2/5, EC-2/3/6 | F2, toolbar, prompt, Esc, gating                           | UT-060–UT-064  | —              | E2E-001         |
| US-002 AC-1, EC-1         | deployment node rename                                     | UT-016, UT-017 | —              | —               |
| US-003 AC-2/3, EC-1/2     | move placement, comments, re-indent, other file, top level | UT-020–UT-024  | IT-004         | E2E-003         |
| US-003 AC-2/4             | references outside / inside the moved block rewritten      | UT-025, UT-026 | —              | E2E-003         |
| US-003 AC-5               | include appended when the moved element would be hidden    | UT-027         | —              | —               |
| US-003 AC-1, EC-4         | move list contents and gating                              | UT-065, UT-066 | —              | E2E-003         |
| US-003 EC-3, US-004 AC-3  | collision, invalid parent                                  | UT-028, UT-029 | —              | —               |
| US-004 AC-2, rule 8       | capture refused, files and snapshots unchanged             | —              | IT-005         | —               |
| US-005, rule 11           | undo / redo restores files and snapshots; stale-undo       | —              | IT-006, IT-007 | E2E-002         |
| US-006                    | LSP prepareRename / rename                                 | UT-050–UT-053  | —              | manual (VSCode) |
| US-007                    | imports and importing references renamed; move refused     | UT-030, UT-031 | —              | —               |
| US-008                    | ops and `viewId` through RPC                               | —              | IT-003         | —               |

## Unit Cases

Planner, rename (`model-change/renameElement.spec.ts`), one row per reference kind, each asserting
all touched files:

- UT-001 — definition name (`api = container` → `gateway = container`).
- UT-002 — relation endpoints: explicit source, implicit source in the block, target.
- UT-003 — qualified chains: `cloud.api` (middle and last segment), unique-descendant shortcut.
- UT-004 — element view rules: `include`, `exclude`, `style`, `with`, `view of`.
- UT-005 — dynamic view steps and their `with` blocks.
- UT-006 — `extend cloud.api` (`StrictFqnElementRef`) and `extend` of an ancestor path.
- UT-007 — deployment `instanceOf cloud.api` and deployment view rules using elements.
- UT-008 — global predicates and styles.
- UT-009 — references in two other files, each file asserted.
- UT-010 — `this` and `it` stay as is.
- UT-011 — renaming an element renames the references to its unnamed instances.
- UT-012 — renaming an unnamed instance inserts `name = ` before `instanceOf`.
- UT-013 — same name → no edits.
- UT-014 — `invalid-name` for `1abc`, `a b`, `''`.
- UT-015 — `name-collision` with a sibling; no collision with a non-sibling of the same name.
- UT-016 — deployment node rename: definition, `extend`, deployment relations, view rules.
- UT-017 — deployment `name-collision`.

Planner, move (`model-change/moveElement.spec.ts`):

- UT-020 — statement appended to the new parent's block, re-indented (spaces, tabs).
- UT-021 — comment lines directly above move with it; a comment separated by a blank line stays.
- UT-022 — parent without a body gets `{ }`.
- UT-023 — new parent in another file: removed from one file, added to the other.
- UT-024 — top level: first `model {}` of the current view's file.
- UT-025 — references outside the block to the element and its descendants → full new FQN.
- UT-026 — short references inside the block to elements outside it → full FQN; references
  within the subtree untouched.
- UT-027 — `include <newFqn>` appended only when the prediction says hidden.
- UT-028 — `name-collision` in the new parent.
- UT-029 — `invalid-parent`: own subtree, current parent; `not-found` for an unknown parent.

Imports (`renameElement.spec.ts`, multi-project fixture):

- UT-030 — import of a renamed root element rewritten, and the importing project's references.
- UT-031 — moving an imported root element → `has-references` with the importing files.

Snapshots (`core/manual-layout/renameFqnsInSnapshot.spec.ts`, `LikeC4ManualLayouts` spec):

- UT-040 — node `id`, `parent`, `children`, `modelRef`, edge `source` / `target` mapped (exact and
  prefix); unrelated ids untouched (`cloud.apiX` not matched by `cloud.api`).
- UT-041 — a rewritten snapshot applied to the recomputed view reports no drift.
- UT-042 — snapshot moved when the view id changes.

LSP rename (`lsp/RenameProvider.spec.ts`):

- UT-050 — `prepareRename` on a definition and on a reference returns the name range.
- UT-051 — `prepareRename` on a kind, a tag, a view, `this` → error.
- UT-052 — `rename` returns the planner's edits for every file.
- UT-053 — `rename` with an invalid name → error, no edits.

Diagram (`editor-ui/*.spec.tsx`, hotkey spec):

- UT-060 — F2 with one selected node opens the prompt with the name selected; with 0 or 2 → no-op.
- UT-061 — prompt validation: invalid name, taken sibling name, Enter disabled.
- UT-062 — Enter sends `rename-element`; Esc sends nothing.
- UT-063 — buttons absent on read-only surfaces and for imported elements.
- UT-064 — `handleChange` resolving with a new `viewId` navigates to it.
- UT-065 — move list: "Top level" first, excludes self, descendants and current parent; filters.
- UT-066 — no "Move to…" on deployment nodes and instances.

## Integration Cases

- IT-001 — rename through `applyChange` (FS branch and faked `applyEdit`): one edit for all files.
- IT-002 — rename with two manual-layout views: both snapshots rewritten, no drift after the rebuild.
- IT-003 — rename of `x` with an unnamed `view of x` as the current view: result `viewId`, snapshot
  moved; same through the vite RPC `updateView`.
- IT-004 — move across files through `applyChange`.
- IT-005 — capture: rename `api` → `db` where a short `db` elsewhere would resolve to it →
  `invalid-result`, every file and snapshot byte-identical.
- IT-006 — undo / redo of a rename restore and re-apply files and snapshots.
- IT-007 — undo after an external edit of one touched file → `stale-undo`, nothing restored.

## E2E Journeys

- E2E-001 — select `cloud.api`, F2, type `gateway`, Enter → files contain `gateway` everywhere,
  the node keeps its position in a manual-layout view.
- E2E-002 — after E2E-001, Ctrl+Z → files and the layout back; Ctrl+Shift+Z → renamed again.
- E2E-003 — toolbar "Move to…" on `cloud.db`, type `cust`, Enter → statement under `customer`,
  references rewritten.

VSCode (manual, Code - OSS): E2E-001–E2E-003 in the preview, plus F2 in the `.c4` editor (US-006)
and a rename touching two files saved by the extension.
