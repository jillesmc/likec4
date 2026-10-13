---
provider: manual
pr:
round: 1
round_created_at: 2026-10-13T21:56:39Z
status: pending
file: packages/language-server/src/model-change/excludeFromView.ts
line: 7
severity: medium
author: claude-code
provider_ref:
---

# Issue 006: Unvalidated client input written into DSL (exclude targets, kinds)

## Review Comment

`exclude-from-view` writes `exclude <target>` using the FQNs received from the client without checking that they exist. `ChangeView` is a public LSP/RPC surface, also used by integrators and agents (US-011), so a malformed or hostile value (e.g. containing `}` and newlines) is written into the view body. The post-apply guard only reverts when a parse/link error appears, so text that happens to parse (e.g. extra rules or `model { ... }` content) stays in the file.

Related: `addElement.ts:41` and `addDeployment.ts:128` validate kinds with `kind in model.specification.elements` / `.deployments`, which also accepts inherited keys such as `constructor` or `toString`.

Suggested fix: validate every exclude target before writing: nodes via `model.findElement` / `model.deployment.findElement` (and the view type), edges via both endpoints. Reject with `not-found`, and also check the value matches the FQN pattern. Use `Object.hasOwn(model.specification.elements, kind)` for kinds. Add specs for an unknown target and for an inherited key used as a kind.

## Triage

- Decision: `UNREVIEWED`
- Notes:
