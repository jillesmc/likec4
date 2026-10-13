---
status: pending
title: "Task 6: Dev-server undo/redo of model edits"
type: feature
complexity: high
---

# Task 6: Dev-server undo/redo of model edits

## Overview

In `likec4 start`, Ctrl+Z / Ctrl+Shift+Z on the canvas undo and redo model edits interleaved with
layout edits, as one history. In VSCode, canvas undo stays layout-only.

## Shippable Outcome

- Outcome: per ADR-003, a server inverse-edit stack (cap 100, `stale-undo` on hash mismatch) is
  exposed via `likec4/undo-change` / `likec4/redo-change` and the vite RPC `undoChange` /
  `redoChange`. The optional port methods are wired in the SPA, and the actor history gains
  `model` entries.
- Verify in this task: the specs below, plus E2E-004.
- Integration verification: none.

## Requirements

- `_spec.md` Business Rule 14, Safety Invariants 2–3; `_dx.md` LSP/RPC sections.
- The stack exists only when there is no LSP connection. With a connection, the requests return
  `unsupported-in-view`.
- Undo/redo share the per-project serialisation from task 01.
- `model` entries are pushed only when the port has `undoModelChange`.
- New RPC methods: `src/rpc/protocol.ts`, `src/rpc/functions/`, wired in `src/rpc/rpc.ts`
  (AGENTS.md vite-plugin rules).

## Subtasks

- [ ] 6.1 Server: `UndoStack.ts`; record inverses after the guard passes; add the undo/redo
  requests.
- [ ] 6.2 vite-plugin: `undoChange` / `redoChange` RPC.
- [ ] 6.3 Diagram: optional `undoModelChange` / `redoModelChange` on `LikeC4EditorCallbacks`, and
  `model` history entries in `actions.ts` undo/redo.
- [ ] 6.4 SPA: wire the port methods in `ViewEditor.tsx`.

## Implementation Details

### Relevant Files

- `packages/diagram/src/editor/actor/actions.ts:95-150` — the existing undo/redo history.
- `packages/diagram/src/editor/actor/hotkey.ts` — the bindings (unchanged).
- `packages/vite-plugin/src/rpc/protocol.ts`, `src/rpc/rpc.ts`, `src/rpc/functions/updateView.ts` —
  the RPC pattern.
- `packages/likec4-spa/src/pages/ViewEditor.tsx:48-70` — the SPA port.

### Related ADRs

- [ADR-003](adrs/adr-003.md) — the undo design.

## Tests

- [ ] UT-130, UT-131, UT-132, UT-133 — undo stack
- [ ] IT-007 — RPC undo/redo round trip
- [ ] IT-009 — unsupported over LSP
- [ ] E2E-004 — canvas Ctrl+Z / Ctrl+Shift+Z
