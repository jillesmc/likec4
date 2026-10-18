---
status: pending
title: "Task 15: QA pass of the amendment in both hosts"
type: test
complexity: medium
---

# Task 15: QA pass of the amendment in both hosts

## Overview

Run the remaining journeys of the 2026-10-18 amendment once, in `likec4 start` and in the VSCode
preview, after tasks 09–14 are merged.

## Shippable Outcome

- Outcome: the full dev-server and static-build E2E suites pass, and a manual checklist of
  US-012 – US-018 passes in Code - OSS, with screenshots as evidence.
- Verify in this task: `pnpm test:dev-server`, the static-build E2E suite, the checklist below.
- Integration verification: this task.

## Requirements

- `_tests.md` E2E section and its VSCode note; `_user_stories.md` US-012 – US-018.
- Reuse the evidence of tasks 09–14; only re-run what changed since.
- Includes the open item from the review round: a canvas change touching two `.c4` files saves
  both documents in VSCode.

## Subtasks

- [ ] 15.1 Full dev-server and static-build E2E runs.
- [ ] 15.2 Code - OSS checklist: identifier prompt, kind/technology, relation retitle, step position
  and removal, manual-layout notice, canvas Ctrl+Z / Ctrl+Shift+Z with snapshot sync, two-file save.
- [ ] 15.3 Evidence in `evidence/task_15/` (`vscode-extension-screenshot-evidence` skill).

## Tests

- [ ] VSCode manual checklist (US-012 – US-018)
