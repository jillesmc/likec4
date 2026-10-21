---
schema_version: 'compozy.tasks/v2'
workflow: visual-to-code-rename-move
graph:
  nodes:
    - id: task_01
      file: task_01.md
    - id: task_02
      file: task_02.md
    - id: task_03
      file: task_03.md
    - id: task_04
      file: task_04.md
    - id: task_05
      file: task_05.md
    - id: task_06
      file: task_06.md
    - id: task_07
      file: task_07.md
    - id: task_08
      file: task_08.md
  edges:
    - from: task_01
      to: task_02
    - from: task_02
      to: task_03
    - from: task_01
      to: task_04
    - from: task_01
      to: task_05
    - from: task_02
      to: task_06
    - from: task_05
      to: task_06
    - from: task_03
      to: task_07
    - from: task_04
      to: task_07
    - from: task_03
      to: task_08
    - from: task_04
      to: task_08
    - from: task_06
      to: task_08
    - from: task_07
      to: task_08
---

# Tasks: Visual-to-code editing, phase 2 (rename and move)

Spec: [_spec.md](_spec.md) · Tests: [_tests.md](_tests.md) · DX: [_dx.md](_dx.md) · UI: [_uiux.md](_uiux.md)

| #  | Task                                                           | Type    | Complexity | Depends on     | MVP           |
| -- | -------------------------------------------------------------- | ------- | ---------- | -------------- | ------------- |
| 01 | Rename engine for elements: references, guard, snapshots, undo | backend | high       | —              | yes (slice 1) |
| 02 | Rename an element from the canvas in both hosts                | feature | medium     | 01             | yes (slice 2) |
| 03 | Rename deployment nodes and instances                          | feature | medium     | 02             | no (slice 3)  |
| 04 | Rename across projects that import the element                 | backend | medium     | 01             | no (slice 4)  |
| 05 | Move engine: cut and paste with reference rewrite              | backend | high       | 01             | no (slice 5)  |
| 06 | Move an element from the canvas with "Move to…"                | feature | medium     | 02, 05         | no (slice 6)  |
| 07 | F2 rename in the .c4 editor                                    | backend | medium     | 03, 04         | no (slice 7)  |
| 08 | QA pass of rename and move in both hosts                       | test    | medium     | 03, 04, 06, 07 | no (slice 8)  |

Tasks 01 + 02 deliver the Motivating Problem's rename half: F2 on a node renames it everywhere,
keeping the manual layouts. After 01, tasks 04 and 05 can run in parallel with 02. Each of 01 and
05 adds a `ViewChange` member, so expect trivial conflicts in `view-changes.ts` and the
`ModelChanges` dispatch switch. Task 07 waits for 03 and 04 so the text rename covers every
reference kind the planner knows.
