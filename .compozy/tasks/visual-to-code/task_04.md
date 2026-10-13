---
status: pending
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

- [ ] 4.1 Core: `ViewChange.ChangeTitle`.
- [ ] 4.2 Server: `changeTitle.ts` for `Element`, `DeploymentNode` and `DeployedInstance`.
- [ ] 4.3 UI: `InlineTitleEditor` on double-click (Enter commits, Esc cancels, empty title →
  error state).

## Implementation Details

### Relevant Files

- `packages/language-server/src/like-c4.langium:126-160,827-860` — title positions and the
  `title` property.
- `packages/language-server/src/model-change/viewChange.ts` — the existing title-change pattern for
  views.
- `packages/diagram/src/base-primitives/` — node title rendering.

## Tests

- [ ] UT-100, UT-101, UT-102, UT-103, UT-104, UT-105 — retitle variants
