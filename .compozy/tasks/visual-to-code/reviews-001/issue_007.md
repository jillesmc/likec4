---
provider: manual
pr:
round: 1
round_created_at: 2026-10-13T21:56:39Z
status: pending
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

- Decision: `UNREVIEWED`
- Notes:
