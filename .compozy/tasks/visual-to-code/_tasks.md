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

Tasks 01 + 02 together deliver the Motivating Problem: connect A → B on the canvas writes `A -> B`.
After 02, tasks 03, 04, 05, 06 and 08 can run in parallel. Each one adds its own `ViewChange`
member(s) to `packages/core/src/types/view-changes.ts`, so expect trivial merge conflicts there and
in the `ModelChanges` dispatch switch.

Defaults in effect (pending owner confirmation, see `_spec.md` Open Questions): ADR-001 relation
placement, D6 strict blocking, Q2 slug naming, Q3 append, Q5 no `Del` in dynamic views, Q7 no new
drift reasons, Q8 non-atomic snapshot write.
