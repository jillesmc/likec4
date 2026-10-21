---
provider: manual
pr:
round: 2
round_created_at: 2026-10-21T00:46:08Z
status: valid
file: packages/diagram/src/editor-ui/ConnectPrompt.tsx
line: 96
severity: high
author: claude-code
provider_ref:
---

# Issue 001: Enter on the Cancel button of the connect prompt creates the relation

## Review Comment

`ConnectPrompt` handles keys on its container `div` (`onKeyDown={onKeyDown}`): Enter calls `onConfirm(values)` whatever has the focus. When a keyboard user tabs to **Cancel** and presses Enter, the keydown bubbles to the container and confirms the connection; the button's own click (cancel) comes after, too late.

Verified with a temporary Playwright scenario against `likec4 start`: connect `customer` → `cloud`, focus "Cancel", press Enter → `model.c4` gets `-> cloud`. This breaks US-013 AC-4 / UT-214 ("Esc cancels and nothing is written"; Cancel must behave the same) and writes to the sources against the user's intent.

Suggested fix: handle Enter only when the event target is an input or select (or attach `onKeyDown` to the fields instead of the container, as `TitlePrompt` does), and let buttons keep their native behaviour. Add an E2E case: focus Cancel, press Enter, assert the file is unchanged and the prompt is closed.

## Triage

- Decision: `VALID`
- Notes: Confirmed with a Playwright scenario: Enter with the focus on "Cancel" wrote `-> cloud`. Root cause: `ConnectPrompt` handles Enter on its container `div`, so the keydown from a focused button confirmed before the button's own click. Fix: Enter confirms only when the target is not a button (a focused button keeps its native Enter → click); Escape still cancels from anywhere.
- Fix: `packages/diagram/src/editor-ui/ConnectPrompt.tsx`. Regression: E2E `review 002-001` (focus Cancel, Enter → prompt closed, file byte-identical); it failed before the fix. Gates: diagram typecheck, diagram 230 passed, dev-server E2E 22 passed (twice), static-build E2E 2 passed.
