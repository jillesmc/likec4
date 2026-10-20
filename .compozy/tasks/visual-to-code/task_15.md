---
status: completed
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

- [x] 15.1 Full dev-server and static-build E2E runs.
- [x] 15.2 Code - OSS checklist: identifier prompt, kind/technology, relation retitle, step position
  and removal, manual-layout notice, canvas Ctrl+Z / Ctrl+Shift+Z with snapshot sync, two-file save.
- [x] 15.3 Evidence in `evidence/task_15/` (`vscode-extension-screenshot-evidence` skill).

## Tests

- [x] VSCode manual checklist (US-012 – US-018)

## Completion Notes (2026-10-19)

- E2E: dev-server 17 passed (twice), static-build 2 passed, after the last code change.
- Code - OSS (Extension Development Host under Xvfb, driven over CDP, fixture with `model.c4`,
  `dynamic.c4` and `views2.c4`): all 17 checks pass in one clean run — identifier prompt (US-012),
  kind/technology (US-013), relation title (US-014), manual-layout notice and first-drop toast
  (US-017), canvas undo/redo with snapshot sync and no drift (US-018), the relation in `model.c4`
  plus the `include` in `views2.c4` both saved, step appended / inserted before step 1 / removed with
  `Del` (US-009, US-015, US-016). Screenshots in `evidence/task_15/`.
- Bugs found by this pass and fixed. The VS Code save fix is covered by this Code - OSS run only
  (failed before, passed after); the other two have E2E checks that fail without the fix:
  - VSCode saved only documents shown in an editor (`workspace.save(uri)`), so the `include` written
    in the view's file stayed unsaved. Documents are now saved with `TextDocument.save()`.
  - After a canvas undo in a manual-layout view, the snapshot refresh cleared the redo history.
    The refresh that follows an undo/redo of a model change keeps it (`keepRedo`); E2E-009 now redoes.
  - The connect / drop / title prompts are rendered in the xyflow viewport portal, which does not
    receive pointer events and sits under the nodes: the connect prompt was hidden behind the target
    node and no prompt button could be clicked. Their containers now have `zIndex: 1000` and
    `pointerEvents: 'all'`; E2E-007 clicks the inputs and the Connect button.
- Not fixed (UX follow-ups, out of this task's scope): the prompts scale with the canvas zoom, and the
  element palette (center-right panel) can cover prompts and nodes in a narrow preview.
- Commits: `fix(vscode)` (background save), `fix(diagram)` + `test(e2e)` (redo after undo in a manual
  layout view), `fix(diagram)` + `test(e2e)` (prompts above the nodes and clickable).

