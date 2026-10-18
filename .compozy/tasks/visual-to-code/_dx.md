# Developer Experience: Visual-to-code editing (phase 1)

This is the public-surface contract for canvas → DSL editing. It is a companion to `_spec.md`
(Part II serves this surface) and `_tests.md` (E2E journeys use these exact invocations).

There is no CLI, no config key and no YAML. The surfaces are the canvas (see `_uiux.md`), the
`ViewChange` TypeScript contract, the LSP request, the vite dev-server RPC, and the
`LikeC4EditorCallbacks` port.

## Golden Path

Project `demo/model.c4`:

```likec4
specification {
  element actor
  element system
}
model {
  // people
  customer = actor 'Customer' {
    description 'A customer of Cloud System'
  }
  cloud = system 'Cloud System'
}
views {
  view index {
    include *
  }
}
```

```bash
pnpm likec4 start demo   # dev server with editing (RPC available)
```

Open view `index` and drag from `customer`'s handle onto `cloud`. The `model` block becomes:

```likec4
model {
  // people
  customer = actor 'Customer' {
    description 'A customer of Cloud System'
    -> cloud
  }
  cloud = system 'Cloud System'
}
```

(`include *` already shows the relation, so no `include` is added.)

and the dev-server log prints:

```
view:onChange project default view index change add-relation
view:onChange ✅
```

## SDK / Bridges

### `ViewChange` ops (`@likec4/core/types`)

Each op is sent with a `viewId`. The DSL each one produces:

```ts
import type { ViewChange } from '@likec4/core/types'

// relation, written inside the source block (ADR-001)
const rel: ViewChange.AddRelation = { op: 'add-relation', source: 'customer', target: 'cloud' }
//  → in customer { … }:   -> cloud

const el: ViewChange.AddElement = { op: 'add-element', parent: 'cloud', kind: 'service', title: 'Billing API' }
//  → in cloud { … }:      billingApi = service 'Billing API'

const node: ViewChange.AddDeploymentNode = { op: 'add-deployment-node', parent: 'prod.eu', kind: 'vm', title: 'Worker' }
//  → in prod.eu { … }:    worker = vm 'Worker'

const inst: ViewChange.AddInstance = { op: 'add-instance', parent: 'prod.eu.worker', element: 'cloud.api' }
//  → in worker { … }:     instanceOf cloud.api

const step: ViewChange.AddDynamicStep = { op: 'add-dynamic-step', source: 'web', target: 'api', title: 'checkout' }
//  → end of dynamic view body:   web -> api 'checkout'

const hide: ViewChange.ExcludeFromView = {
  op: 'exclude-from-view',
  targets: [{ node: 'cloud.db' }, { edge: { source: 'cloud.api', target: 'cloud.db' } }],
}
//  → end of view body:   exclude cloud.db
//                        exclude cloud.api -> cloud.db

const del: ViewChange.DeleteFromModel = { op: 'delete-from-model', target: { element: 'cloud.legacy' } }
//  → removes the whole `legacy = … { … }` definition (refused if referenced)

const retitle: ViewChange.ChangeTitle = { op: 'change-title', target: 'cloud.api', title: 'Public API' }
//  → api = service 'API'   becomes   api = service 'Public API'
```

Amendment of 2026-10-18:

```ts
const typed: ViewChange.AddRelation = {
  op: 'add-relation', source: 'cloud.api', target: 'cloud.queue',
  title: 'publishes', kind: 'async', technology: 'Kafka',
}
//  → in api { … }:   -[async]-> cloud.queue 'publishes' {
//                      technology 'Kafka'
//                    }

const named: ViewChange.AddElement = { op: 'add-element', parent: null, kind: 'system', title: 'Payment Service', name: 'payments' }
//  → payments = system 'Payment Service'      (the canvas always sends `name`, US-012)

const relTitle: ViewChange.ChangeTitle = { op: 'change-title', target: { relation: 'r1a2b3' }, title: 'reads orders' }
//  → api -> db 'reads'   becomes   api -> db 'reads orders'

const placed: ViewChange.AddDynamicStep = { op: 'add-dynamic-step', source: 'web', target: 'api', beforeStep: 1 }
//  → inserted on its own line before the 2nd top-level step

const unstep: ViewChange.RemoveDynamicStep = { op: 'remove-dynamic-step', step: 'step-02:par.01' }
//  → removes that step's statement (refused for steps of a chain)
```

Identifier suggestion, shared by the canvas and the server:

```ts
import { deriveIdentifier, isValidIdentifier } from '@likec4/core/utils'

deriveIdentifier('Payment Service', 'system', new Set(['paymentService'])) // 'paymentService2'
isValidIdentifier('9lives') // false
```

(The literals are shown untagged for readability. Real code uses `Fqn(...)` etc. from
`@likec4/core/types`.)

When a created item would be hidden by the view's predicates, the same edit also appends
`include <fqn>` (elements) or `include <source> -> <target>` (relations) to the view body.

### Editor port (`@likec4/diagram`)

```tsx
<LikeC4EditorProvider
  editor={{
    fetchView: (id, layout) => /* unchanged */,
    // MUST reject when the change was not applied, so the ghost is removed and a toast shown
    handleChange: async (viewId, change) => {
      await likec4rpc.updateView({ projectId, viewId, change }) // throws on failure
    },
    // optional: makes Ctrl+Z / Ctrl+Shift+Z on the canvas undo/redo model edits
    // (wired in the dev server and, since ADR-004, in the VSCode preview)
    undoModelChange: (viewId, historyId) => likec4rpc.undoChange({ projectId, historyId }),
    redoModelChange: (viewId, historyId) => likec4rpc.redoChange({ projectId, historyId }),
  }}>
  <LikeC4Diagram view={view} />
</LikeC4EditorProvider>
```

Without an editor port (static build), the diagram renders with no editing affordance.

### LSP request `likec4/change-view`

Request:

```json
{ "viewId": "index", "projectId": "default",
  "change": { "op": "add-relation", "source": "customer", "target": "cloud" } }
```

Success:

```json
{ "success": true,
  "location": { "uri": "file:///ws/model.c4",
                "range": { "start": { "line": 3, "character": 4 }, "end": { "line": 3, "character": 15 } } } }
```

Failure:

```json
{ "success": false, "code": "not-found", "error": "Element \"cloud.ui\" not found" }
```

### LSP requests `likec4/undo-change`, `likec4/redo-change`

Request `{ "projectId": "default", "historyId": "h3" }` (`historyId` optional: when given, the
request is refused with `stale-undo` unless it is the latest entry). The response has the same
shape as `change-view`, including `modifiedUris`. Since ADR-004 this works over an LSP connection
too: the restored texts are applied as one `WorkspaceEdit`, and the VSCode extension saves the
modified documents.

### vite RPC (`likec4:rpc`)

```ts
import { likec4rpc } from 'likec4:rpc'

await likec4rpc.updateView({ projectId: 'default', viewId: 'index', change })   // resolves | throws Error(message)
await likec4rpc.undoChange({ projectId: 'default' })                             // resolves | throws Error(message)
await likec4rpc.redoChange({ projectId: 'default' })
```

The dev-server log on failure:

```
Failed to apply view change:
[name-collision] Element "cloud.billingApi" already exists
```

## Errors

| Code | Condition | Message (example) | User action |
|---|---|---|---|
| `not-found` | source/target/parent/element/relation/view missing at apply time, or undo/redo stack empty | `Element "cloud.ui" not found` / `Nothing to undo` | Refresh; the model changed |
| `invalid-name` | explicit `name` does not match the identifier grammar | `Invalid identifier "billing api"` | Use letters, digits, `-`, `_` |
| `name-collision` | explicit `name` already used by a sibling | `Element "cloud.billingApi" already exists` | Pick another name |
| `unknown-kind` | element, deployment or relationship kind not declared in `specification {}` | `Unknown element kind "servise"` / `Unknown relationship kind "asinc"` | Declare it in the specification first |
| `read-only-target` | parent/target defined in another project or outside the workspace, or a relation to retitle that is not defined in this project | `"shared.auth" is defined in another project` | Edit it in its own project |
| `has-references` | delete-from-model while references exist | `Element "cloud.legacy" is referenced in 3 places` | Remove the references first |
| `unsupported-in-view` | op not valid for the view type, or a step of a chain to remove | `add-dynamic-step is not supported in element views` / `Steps of a chain cannot be removed from the canvas` | — |
| `invalid-result` | the edit introduced errors; it was reverted | `Change reverted: <first diagnostic message>` | Fix the surrounding DSL, then retry |
| `apply-failed` | the editor/filesystem refused the write | `Failed to apply changes: <reason>` | Check that the file is writable |
| `stale-undo` | file changed since the edit being undone | `File changed since this edit; undo unavailable` | Undo in the text editor |

On the canvas, every code surfaces as a toast with the message. Through the vite RPC, the thrown
`Error.message` is `[<code>] <message>`.
