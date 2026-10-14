---
provider: manual
pr:
round: 1
round_created_at: 2026-10-13T21:56:39Z
status: valid
file: packages/language-server/src/model-change/ModelChanges.ts
line: 81
severity: medium
author: claude-code
provider_ref:
---

# Issue 002: Serialization queue keyed by raw projectId, history by resolved id

## Review Comment

`enqueue()` keys the per-project queue by `projectId ?? ''`, the raw value received from the caller, while the undo history (`historyOf`) and all handlers use `ProjectsManager.ensureProject(projectId).id`. Requests for the same project that arrive with `projectId: undefined` and with `projectId: 'default'` (e.g. LSP clients that omit it, and the vite RPC that always sends it) end up in two different queues and can run concurrently. Both then read and write the same documents and the same history stacks, which breaks Safety Invariant 2 ("per project, applyChange / undoChange / redoChange execute strictly one at a time").

Suggested fix: resolve the project id before enqueueing, e.g. `const key = this.services.shared.workspace.ProjectsManager.ensureProject(projectId as ProjectId).id`, falling back to the raw value only when resolution throws. Add a spec in `addRelation.spec.ts` (IT-008 style) that fires one request without `projectId` and one with the default id, and asserts they run one at a time.

## Triage

- Decision: `VALID`
- Notes: Valid. `enqueue()` keys by the raw `projectId` while history and handlers use the resolved id, so `undefined` and `'default'` use two queues. Fix: resolve the id with `ProjectsManager.ensureProject` before enqueueing (fall back to the raw value if it throws). Spec: concurrent requests with and without `projectId`.
- Fix: Fixed: `enqueue()` keys the queue by `ProjectsManager.ensureProject(projectId).id`. Verified by `addRelation.spec.ts` ('requests with and without projectId share the same queue'). Gates: `pnpm typecheck` passed (26 tasks); language-server 919 passed; diagram 200 passed; vite-plugin 40 passed + the pre-existing `detect-ai` failure; dev-server E2E 12 passed (2 runs); static-build E2E 2 passed.
