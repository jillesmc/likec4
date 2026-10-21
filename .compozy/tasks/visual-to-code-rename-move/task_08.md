---
status: completed
title: 'Task 08: QA pass of rename and move in both hosts'
type: test
complexity: medium
---

# Task 08: QA pass of rename and move in both hosts

## Overview

Run the remaining journeys once, in `likec4 start` and in the VSCode preview, after tasks 01–07.

## Shippable Outcome

- Outcome: the full dev-server and static-build E2E suites pass, and a Code - OSS checklist of
  US-001 – US-007 passes, with screenshots as evidence.
- Verify in this task: `pnpm test:dev-server`, the static-build E2E suite, the checklist below.
- Integration verification: this task.

## Requirements

- `_tests.md` E2E Journeys and its VSCode note; `_user_stories.md` US-001 – US-007.
- Reuse the evidence of tasks 02 and 06; only re-run what changed since.

## Subtasks

- [x] 8.1 Full dev-server and static-build E2E runs.
- [x] 8.2 Code - OSS checklist: canvas rename (element, deployment node, instance), rename touching
      two files (both saved), unnamed view id change, move across files, undo/redo, F2 in the `.c4`
      editor, rename of an element imported by another project.
- [x] 8.3 Evidence in `evidence/task_08/`.

## Tests

- [x] VSCode manual checklist (US-001 – US-007)

## Completion Notes (2026-10-21)

- E2E after the last change (task 07): dev-server 25 passed, static-build 2 passed.
- Code - OSS (Extension Development Host under Xvfb, driven over CDP), fixture with two projects:
  `a` (`model.c4` with an unnamed `view of cloud` titled "Cloud overview", `deployment.c4` with an
  unnamed instance, `other.c4`) and `b` (`import { cloud } from 'a'`). 25/25 checks pass:
  - US-001 / US-007: rename of `cloud` to `platform` from the unnamed view: `a/model.c4` (definition,
    relation, `view of`), `a/deployment.c4` (`instanceOf`), `b/model.c4` (import and `-> platform.api`)
    rewritten and saved; the canvas follows the view under its new id.
  - US-002: rename of the deployment node `prod` (definition and view rule), then of the unnamed
    instance `vm1.api` (`apiMain = instanceOf platform.api`); the canvas shows the new ids.
  - US-003 / US-005: "Move to…" of `customer` into `billing` (`other.c4`): the statement leaves
    `model.c4`, lands in `billing`'s block with its relation, `include billing.customer` keeps it in
    `index`; Ctrl+Z restores both files, Ctrl+Shift+Z moves it again; documents saved.
  - US-006: F2 in the `.c4` editor on a kind → "The element can't be renamed."; on `api` → the
    definition, `instanceOf platform.api` and project `b`'s reference are renamed.
- Screenshots in `evidence/task_08/` (task 02 and 06 evidence reused for the single-project cases).
- Findings, not changed by this delivery:
  - `include prod.**` in a deployment view showed only `prod` (nested nodes needed explicit
    includes in the fixture); unrelated to rename/move.
  - A gesture refused by the validity guard leaves the reverted document marked unsaved in VSCode
    (content identical) — phase-1 revert path.
