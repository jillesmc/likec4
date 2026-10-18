---
status: completed
title: "Task 9: Identifier prompt with an editable suggestion"
type: feature
complexity: medium
---

# Task 9: Identifier prompt with an editable suggestion

## Overview

The drop popover asks for the identifier of a new element, deployment node or instance. It is
prefilled with the suggestion the server would derive, and is easy to accept (Enter) or replace
(typing over the selected text). Owner decision Q2, 2026-10-18.

## Shippable Outcome

- Outcome: `deriveIdentifier` / `isValidIdentifier` live in `@likec4/core/utils` and are used by
  the server and the popover. The popover has an `Identifier` field that follows the title until
  edited, selects all on focus, validates inline, and its value is sent as `name`.
- Verify in this task: the specs below, plus E2E-006.
- Integration verification: none.

## Requirements

- `_spec.md` Business Rule 5; `_uiux.md` S4 (2026-10-18 change); `_dx.md` identifier snippet;
  `_user_stories.md` US-012.
- Hard cut of `language-server/src/model-change/_naming.ts`: move the module and its spec to core,
  update the server callers in the same change (Impact Analysis row "moved").
- Run `pnpm exec tsc --build` after the core export, before typechecking downstream.
- The server keeps validating `name` (`invalid-name`, `name-collision`); requests without `name`
  still derive one (US-011).
- Collision check client-side uses the siblings of the drop parent from the `LikeC4Model` in memory
  (elements, or deployment children for nodes and instances).

## Subtasks

- [x] 9.1 Core: move `_naming.ts` → `packages/core/src/utils/identifier.ts`, export from
  `@likec4/core/utils`, move `_naming.spec.ts`.
- [x] 9.2 Server: import from core in `addElement.ts`, `addDeployment.ts`.
- [x] 9.3 Diagram: `Identifier` field in `TitlePrompt` (and the instance picker), follow/override
  state, select-on-focus, inline validation, `name` in the emitted change.
- [x] 9.4 E2E: E2E-006 in `e2e/tests/visual-to-code.spec.ts`; update existing palette scenarios if
  they relied on the derived name.

## Implementation Details

### Relevant Files

- `packages/language-server/src/model-change/_naming.ts`, `_naming.spec.ts` — module to move.
- `packages/core/src/utils/index.ts` — `@likec4/core/utils` barrel.
- `packages/diagram/src/editor-ui/TitlePrompt.tsx`, `useCanvasDrop.tsx`, `palette.spec.tsx` —
  popover and its specs.

## Tests

- [x] UT-200 — existing naming cases pass against core
- [x] UT-201, UT-202, UT-203 — prefill, follow/override, select on focus
- [x] UT-204, UT-205 — validation, `name` sent
- [x] UT-206 — instance suggestion
- [x] E2E-006 — typed identifier written

## Completion Notes (2026-10-18)

- Core: `deriveIdentifier` / `isValidIdentifier` moved to `@likec4/core/utils` (`utils/identifier.ts`,
  spec moved along); the language server imports them from there.
- Server: an instance whose name equals the element name keeps the short `instanceOf <fqn>` form,
  also when the name is explicit (the canvas always sends it now).
- Diagram: `editor-ui/identifier.ts` (`takenNames`, `shownIdentifier`, `identifierError`) and an
  optional `identifier` field in `TitlePrompt`: prefilled with the suggestion, follows the title until
  something is typed, empty field follows again, focus selects all, inline error
  (`Invalid identifier` / `Already used by a sibling`) disables confirm. `useCanvasDrop` computes the
  siblings from the `LikeC4Model` in memory and sends `name`; without a model the field is absent and
  the server derives the name.
- UT-203 (select on focus) and UT-205 (`name` sent) are covered by E2E-006, since editor-ui specs
  render statically (no DOM).
- Verification: core 1163 passed; language-server 915 passed (the naming spec moved to core);
  diagram 210 passed; `pnpm typecheck` 26/26; dev-server E2E 14 passed (new E2E-006; deployment
  scenario still writes `instanceOf cloud.api`); static-build E2E 2 passed.

