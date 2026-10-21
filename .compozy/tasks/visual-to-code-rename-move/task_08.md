---
status: pending
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

- [ ] 8.1 Full dev-server and static-build E2E runs.
- [ ] 8.2 Code - OSS checklist: canvas rename (element, deployment node, instance), rename touching
      two files (both saved), unnamed view id change, move across files, undo/redo, F2 in the `.c4`
      editor, rename of an element imported by another project.
- [ ] 8.3 Evidence in `evidence/task_08/`.

## Tests

- [ ] VSCode manual checklist (US-001 – US-007)
