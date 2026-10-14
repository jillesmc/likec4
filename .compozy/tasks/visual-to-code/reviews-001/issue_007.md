---
provider: manual
pr:
round: 1
round_created_at: 2026-10-13T21:56:39Z
status: valid
file: packages/vscode/src/panel/activateMessenger.ts
line: 153
severity: medium
author: claude-code
provider_ref:
---

# Issue 007: VSCode saves only the first file of multi-file edits

## Review Comment

After a successful change, the extension reveals and saves only `result.location.uri` (`vscode.workspace.save(location.uri)`). Model changes are now applied as one multi-file `WorkspaceEdit` (ADR-001: relation in the source file plus `include` in the view file; same for elements and deployment items). The second file is modified but left unsaved in VSCode. The dev server, CLI and other tools reading from disk do not see the `include`, and the user is prompted about unsaved changes in a file they never edited. This was found during task 02 and is still open.

Suggested fix: return all touched URIs from `ChangeView` (e.g. `locations: Location[]` or `uris: string[]`) and save each of them in `activateMessenger.ts`, revealing only the main location.

## Triage

- Decision: `VALID`
- Notes: Valid. The extension saves only `location.uri`. Fix: `ChangeView.Res` success carries `modifiedUris` (all touched documents of the plan); `activateMessenger.ts` saves each of them. The legacy single-file ops are unaffected.
- Fix: Fixed: `ChangeView.Res.modifiedUris` lists all touched documents; `useRpc.changeView` converts them, and `activateMessenger.ts` saves each one. The server side is verified by `addRelation.spec.ts` IT-002 (two uris). The VSCode save loop was typechecked but not exercised in VSCode. Gates: `pnpm typecheck` passed (26 tasks); language-server 919 passed; diagram 200 passed; vite-plugin 40 passed + the pre-existing `detect-ai` failure; dev-server E2E 12 passed (2 runs); static-build E2E 2 passed.
