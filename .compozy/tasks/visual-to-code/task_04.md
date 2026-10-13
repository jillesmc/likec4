---
status: completed
title: "Task 4: Inline retitle of nodes"
type: feature
complexity: medium
---

# Task 4: Inline retitle of nodes

## Overview

An architect double-clicks a node title, types, and presses Enter. The title literal in the
sources changes in place. This covers elements, deployment nodes and deployed instances.

## Shippable Outcome

- Outcome: `change-title` replaces the positional title or `title` property, or inserts a
  positional title (Business Rule 10). Esc cancels; an unchanged title writes nothing.
- Verify in this task: the handler specs below, plus a manual check in `likec4 start`.
- Integration verification: none.

## Requirements

- `_uiux.md` S5; `_user_stories.md` US-003.
- The inline editor is absent when read-only or stub.
- Quotes are escaped with the same helper as task 03 if it is already merged; otherwise implement
  it in a shared `_naming.ts`/`_strings.ts` and reconcile on merge.

## Subtasks

- [x] 4.1 Core: `ViewChange.ChangeTitle`.
- [x] 4.2 Server: `changeTitle.ts` for `Element`, `DeploymentNode` and `DeployedInstance`.
- [x] 4.3 UI: `InlineTitleEditor` on double-click (Enter commits, Esc cancels, empty title →
  error state).

## Implementation Details

### Relevant Files

- `packages/language-server/src/like-c4.langium:126-160,827-860` — title positions and the
  `title` property.
- `packages/language-server/src/model-change/viewChange.ts` — the existing title-change pattern for
  views.
- `packages/diagram/src/base-primitives/` — node title rendering.

## Tests

- [x] UT-100, UT-101, UT-102, UT-103, UT-104, UT-105 — retitle variants

## Completion Notes (2026-10-13)

- Server: `changeTitle.ts` handles `Element`, `DeploymentNode` and `DeployedInstance`. It updates
  the body `title` property when present, else the positional title, else inserts the title after
  `name`/`kind` (or after `instanceOf <target>`). The same title is a no-op (`No changes to apply`).
  An empty title is rejected (`invalid-name`), and an imported element is rejected
  (`read-only-target`).
- UI: `useTitleEditing` (double-click on a node) opens `TitlePrompt` over the node. The prompt
  is reused from the drop popover, which was renamed from `DropPopover`. Enter saves, Esc cancels,
  an empty title is refused, and an unchanged title is not sent. Enabled in element and deployment
  views (not dynamic), only when editing is unlocked.
- The manual check in `likec4 start` was replaced by an automated E2E in the dev-server suite
  (`US-003: double-clicking a node edits its title in the sources`).
- Fix found here: `e2e/.gitignore` ignores `tests/*.spec.ts`, so `tests/visual-to-code.spec.ts`
  (E2E-001, E2E-002) was missing from the task 02/03 commits. It is now allow-listed and
  committed.
- Verification: language-server 883 passed; diagram 179 passed; `pnpm typecheck` passed (26 tasks);
  dev-server E2E 3 passed (2 runs).
