---
provider: manual
pr:
round: 2
round_created_at: 2026-10-21T00:46:08Z
status: valid
file: packages/diagram/src/editor-ui/ConnectPrompt.tsx
line: 157
severity: medium
author: claude-code
provider_ref:
---

# Issue 003: Open canvas prompts survive a navigation to another view

## Review Comment

The pending state of the canvas prompts lives in hooks of `LikeC4DiagramXYFlow`: `useConnectPrompt` (`pending`), `useCanvasDrop` (`drop`) and `useTitleEditing` (`editing`). That component is not remounted when the diagram navigates to another view (`LikeC4Diagram.tsx` renders it once inside `DiagramActorProvider`, the view changes in place), and nothing clears these states on a view change.

Scenario: connect A → B (prompt opens), then navigate (navigation panel, back button, or a `navigateTo` element) without closing it. The prompt is still shown at the old flow coordinates; confirming sends `add-relation` with the old source/target to the editor of the **new** view, and the server may append `include A -> B` to that unrelated view (visibility prediction runs against the new view id). The same applies to a pending palette drop (old parent) and an open title editor.

Suggested fix: close the pending prompts when the view id changes (e.g. reset the three states in an effect keyed by `view.id`, or key the prompt-owning hooks by the view id).

## Triage

- Decision: `VALID`
- Notes: Root cause: the pending state of the connect, drop and title prompts lives in hooks of `LikeC4DiagramXYFlow`, which stays mounted when another view is shown, and nothing reset it. Fix: each hook exposes `close()`, and `DiagramXYFlow` closes the three prompts when the view id changes.
- Fix: `ConnectPrompt.tsx`, `useCanvasDrop.tsx`, `useTitleEditing.tsx`, `DiagramXYFlow.tsx`. Regression: E2E `review 002-003` (open the connect prompt, client-side navigation to another view → no prompt); it failed before the fix. Gates as in issue 001.
