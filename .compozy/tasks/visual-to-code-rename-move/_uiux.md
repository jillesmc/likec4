# UI/UX Change Map: Visual-to-code editing, phase 2 (rename and move)

Diagram surfaces touched by the feature. There are no named visual references: every surface uses
the existing Mantine components, PandaCSS tokens and the phase-1 prompt components
(`PromptPortal`, `TitlePrompt`). Companions: `_spec.md` Part I, `_user_stories.md`, `_dx.md`.

## Design constraints

- Phase-1 constraints hold: affordances absent on read-only surfaces, prompts at a constant size
  above the nodes and kept inside the canvas, messages from `_dx.md` verbatim.
- **Keyboard**: F2 opens the rename prompt for the single selected node. Inside prompts Enter
  confirms, Esc cancels, arrows move in the list.
- **Toolbar**: the new buttons sit next to "Delete from model", with the same size and tooltip
  style.

## Surface map

| #  | Surface                            | Kind     | Core change                                                                                                                                                                    | Stories        |
| -- | ---------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| R1 | Element / compound toolbar         | modified | "Rename identifier" (icon `IconCursorText`) and "Move to…" (icon `IconArrowMoveRight`) buttons                                                                                 | US-001, US-003 |
| R2 | Deployment node / instance toolbar | modified | "Rename identifier" only                                                                                                                                                       | US-002         |
| R3 | Rename prompt                      | new      | `TitlePrompt` with one field, label `Identifier`, current name selected, identifier validation                                                                                 | US-001, US-002 |
| R4 | Move prompt                        | new      | `TitlePrompt` with `options`: "Top level", then the FQN of each possible parent, suggested while typing (phase-1 "Element to deploy" pattern); only a listed value is accepted | US-003         |
| R5 | F2 hotkey                          | new      | Bound on the canvas (`DiagramXYFlow`); ignored while a text field has focus                                                                                                    | US-001         |

## States

| Surface | State                | Behaviour                                                                             |
| ------- | -------------------- | ------------------------------------------------------------------------------------- |
| R3      | invalid name         | Error text `Invalid identifier` (phase-1 identifier prompt), Enter disabled           |
| R3      | taken name           | Error text `Already used by a sibling` (phase-1 identifier prompt), Enter disabled    |
| R3, R4  | pending              | The prompt closes; the node stays as is until the view updates (no ghost for renames) |
| R3, R4  | refused              | Phase-1 failure toast with the server message                                         |
| R4      | no match             | Move button disabled, Enter does nothing                                              |
| R1, R2  | read-only / imported | Buttons absent                                                                        |
| any     | view id changed      | The canvas switches to the new id without a reload                                    |
