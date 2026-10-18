---
schema_version: "compozy.tasks/v2"
workflow: visual-to-code
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
    - id: task_09
      file: task_09.md
    - id: task_10
      file: task_10.md
    - id: task_11
      file: task_11.md
    - id: task_12
      file: task_12.md
    - id: task_13
      file: task_13.md
    - id: task_14
      file: task_14.md
    - id: task_15
      file: task_15.md
  edges:
    - from: task_01
      to: task_02
    - from: task_02
      to: task_03
    - from: task_02
      to: task_04
    - from: task_02
      to: task_05
    - from: task_02
      to: task_06
    - from: task_03
      to: task_07
    - from: task_02
      to: task_08
    - from: task_03
      to: task_09
    - from: task_07
      to: task_09
    - from: task_09
      to: task_10
    - from: task_04
      to: task_11
    - from: task_05
      to: task_11
    - from: task_08
      to: task_12
    - from: task_10
      to: task_12
    - from: task_03
      to: task_13
    - from: task_06
      to: task_14
    - from: task_09
      to: task_15
    - from: task_10
      to: task_15
    - from: task_11
      to: task_15
    - from: task_12
      to: task_15
    - from: task_13
      to: task_15
    - from: task_14
      to: task_15
---

# Tasks: Visual-to-code editing (phase 1)

Spec: [_spec.md](_spec.md) · Tests: [_tests.md](_tests.md) · DX: [_dx.md](_dx.md) · UI: [_uiux.md](_uiux.md)

| # | Task | Type | Complexity | Depends on | MVP |
|---|---|---|---|---|---|
| 01 | Model-change pipeline and add-relation over LSP/RPC | backend | high | — | yes (slice 1) |
| 02 | Connect on canvas with ghost feedback in both hosts | feature | high | 01 | yes (slice 1) |
| 03 | Palette and add-element with manual-layout placement | feature | high | 02 | yes (slice 2) |
| 04 | Inline retitle of nodes | feature | medium | 02 | yes (slice 3) |
| 05 | Exclude from view and delete from model | feature | high | 02 | yes (slice 4) |
| 06 | Dev-server undo/redo of model edits | feature | high | 02 | no (slice 5) |
| 07 | Deployment views: add deployment node and instance | feature | medium | 03 | no (slice 6) |
| 08 | Dynamic views: add step on connect | feature | medium | 02 | no (slice 7) |
| 09 | Identifier prompt with an editable suggestion | feature | medium | 03, 07 | no (slice 8, Q2) |
| 10 | Connect popover with relation kind and technology | feature | medium | 09 | no (slice 9, Q4) |
| 11 | Edit a relation title in place | feature | medium | 04, 05 | no (slice 10, Q6) |
| 12 | Dynamic views: step position and step removal | feature | high | 08, 10 | no (slice 11, Q3, Q5) |
| 13 | Manual-layout notice when adding elements | feature | low | 03 | no (slice 12, Q7) |
| 14 | Canvas undo of model edits in VSCode | feature | high | 06 | no (slice 13, Q8) |
| 15 | QA pass of the amendment in both hosts | test | medium | 09–14 | no |

Tasks 01 + 02 together deliver the Motivating Problem: connect A → B on the canvas writes `A -> B`.
After 02, tasks 03, 04, 05, 06 and 08 can run in parallel. Each one adds its own `ViewChange`
member(s) to `packages/core/src/types/view-changes.ts`, so expect trivial merge conflicts there and
in the `ModelChanges` dispatch switch.

Amendment of 2026-10-18 (owner answers to Q2–Q8, `_spec.md` Resolved Questions): tasks 09–15.
Tasks 09, 11, 13 and 14 can start in parallel. 10 waits for 09 (shared popover form), 12 waits for
10 (shared connect popover), and 15 runs last. Task 14 reassigns IT-009 from task 06 (ADR-004).
