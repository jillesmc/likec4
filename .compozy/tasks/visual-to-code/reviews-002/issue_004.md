---
provider: manual
pr:
round: 2
round_created_at: 2026-10-21T00:46:08Z
status: valid
file: .compozy/tasks/visual-to-code/_spec.md
line: 138
severity: low
author: claude-code
provider_ref:
---

# Issue 004: Contracts still promise read-only-target for relations of other projects

## Review Comment

Task 11 dropped the `read-only-target` branch of the relation retitle (relations of other projects are not imported into a project's model, so no canvas edge can target one; an unknown id is `not-found`). The decision is recorded only in `task_11.md`. The contracts still state the old behaviour:

- `_spec.md` Business Rule 10: "only an edge backed by exactly one relation defined in this project offers it (other edges: `read-only-target`)".
- `_dx.md` Errors table: `read-only-target` "... or a relation to retitle that is not defined in this project".
- `_tests.md` UT-224 and `_user_stories.md` US-014 EC-1 mention `read-only-target` for a relation of another project; the implemented UT-224 only covers `not-found`.

Suggested fix: update the four contracts to the implemented behaviour (`not-found` for an id unknown to the project, with the reason), so that the test contract and the suite agree.

## Triage

- Decision: `VALID`
- Notes: The contracts still described the `read-only-target` branch dropped in task 11 (relations of other projects are not imported, so no edge can target one). Updated `_spec.md` rule 10, the `_dx.md` errors table, `_tests.md` UT-224 and `_user_stories.md` US-014 EC-1 to the implemented behaviour (`not-found` for an id unknown to the project). Documentation only, no code change.
