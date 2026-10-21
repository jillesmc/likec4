import {
  type FqnRenames,
  type LayoutedView,
  type ProjectId,
  type ViewChange,
  type ViewId,
  invariant,
  nonexhaustive,
  renameFqn,
  renameFqnsInSnapshot,
} from '@likec4/core'
import { loggable, wrapError } from '@likec4/log'
import { type LangiumDocument, TextDocument, URI } from 'langium'
import { DiagnosticSeverity, Range, TextEdit } from 'vscode-languageserver-types'
import { logger as mainLogger } from '../logger'
import type { LikeC4ModelLocator, ViewLocateResult } from '../model'
import type { LikeC4Services } from '../module'
import type { ChangeView, UndoChange } from '../protocol'
import type { ModelChangePlan } from './_anchors'
import { brokenReference, resolvedReferences } from './_guard'
import { addDeploymentNode, addInstance } from './addDeployment'
import { addDynamicStep } from './addDynamicStep'
import { addElement } from './addElement'
import { addRelation } from './addRelation'
import { changeElementStyle } from './changeElementStyle'
import { changeTitle } from './changeTitle'
import { changeViewLayout } from './changeViewLayout'
import { deleteFromModel } from './deleteFromModel'
import { excludeFromView } from './excludeFromView'
import { ModelChangeError } from './ModelChangeError'
import { moveElement } from './moveElement'
import { removeDynamicStep } from './removeDynamicStep'
import { renameElement } from './renameElement'
import { changePropertyHandler, preparePayload } from './viewChange'

const logger = mainLogger.getChild('model-changes')

/**
 * Changes that modify the model (not only the view)
 */
type ModelChangeOp =
  | ViewChange.AddRelation
  | ViewChange.AddElement
  | ViewChange.ChangeTitle
  | ViewChange.ExcludeFromView
  | ViewChange.DeleteFromModel
  | ViewChange.AddDeploymentNode
  | ViewChange.AddInstance
  | ViewChange.AddDynamicStep
  | ViewChange.RemoveDynamicStep
  | ViewChange.RenameElement
  | ViewChange.MoveElement

const isModelChangeOp = (change: ViewChange): change is ModelChangeOp =>
  change.op === 'add-relation'
  || change.op === 'add-element'
  || change.op === 'change-title'
  || change.op === 'exclude-from-view'
  || change.op === 'delete-from-model'
  || change.op === 'add-deployment-node'
  || change.op === 'add-instance'
  || change.op === 'add-dynamic-step'
  || change.op === 'remove-dynamic-step'
  || change.op === 'rename-element'
  || change.op === 'move-element'

type ApplyEditsResult = { applied: true } | { applied: false; reason: string }

/**
 * Manual-layout snapshot of a view before and after a change (null: no snapshot)
 */
type SnapshotChange = { projectId: ProjectId; viewId: ViewId; before: LayoutedView | null; after: LayoutedView | null }

type HistoryEntry = {
  id: string
  files: Array<{ uri: string; before: string; after: string }>
  snapshots?: SnapshotChange[]
}

const HISTORY_LIMIT = 100
/**
 * Maximum size of the texts kept in the history of a project (characters)
 */
const HISTORY_MAX_SIZE = 20_000_000

type UndoRedoParams = UndoChange.Params

const entrySize = (entry: HistoryEntry) => entry.files.reduce((size, f) => size + f.before.length + f.after.length, 0)

type ViewOf = { id: ViewId; viewOf: string | null }

/**
 * Renames of elements of a project, as seen from other projects (global ids `@project.fqn`)
 */
function globalRenames(projectId: ProjectId, renames: FqnRenames['elements']): Map<string, string> {
  return new Map([...renames ?? []].map(([from, to]) => [`@${projectId}.${from}`, `@${projectId}.${to}`]))
}

/**
 * Views whose id changed with the renames: an unnamed `view of x` has an id derived from `x`
 */
function viewIdChanges(before: ViewOf[], after: ViewOf[], renames: FqnRenames): Map<ViewId, ViewId> {
  const beforeIds = new Set(before.map(v => v.id))
  const afterIds = new Set(after.map(v => v.id))
  const changes = new Map<ViewId, ViewId>()
  for (const view of before) {
    if (!view.viewOf || afterIds.has(view.id)) {
      continue
    }
    const viewOf = renameFqn(renames.elements, view.viewOf)
    const renamed = after.find(v => v.viewOf === viewOf && !beforeIds.has(v.id))
    if (renamed) {
      changes.set(view.id, renamed.id)
    }
  }
  return changes
}

const errorsOf = (doc: LangiumDocument | undefined): string[] =>
  (doc?.diagnostics ?? [])
    .filter(d => d.severity === DiagnosticSeverity.Error)
    .map(d => typeof d.message === 'string' ? d.message : d.message.value)

export class LikeC4ModelChanges {
  private locator: LikeC4ModelLocator

  constructor(private services: LikeC4Services) {
    this.locator = services.likec4.ModelLocator
  }

  /**
   * Last scheduled change per project, used to apply changes one at a time
   */
  private queues = new Map<string, Promise<unknown>>()

  /**
   * Applies the change to the sources.
   * Changes of the same project are applied one at a time, in arrival order.
   */
  public applyChange(changeView: ChangeView.Params): Promise<ChangeView.Res> {
    return this.enqueue(changeView.projectId, () => this.applyChangeNow(changeView))
  }

  protected enqueue<T>(projectId: string | undefined, fn: () => Promise<T>): Promise<T> {
    // Same queue for the same project, whether the id is given or not
    let key: string
    try {
      key = this.services.shared.workspace.ProjectsManager.ensureProject(projectId as ProjectId).id
    } catch {
      key = projectId ?? ''
    }
    const next = (this.queues.get(key) ?? Promise.resolve()).then(fn)
    this.queues.set(key, next.catch(() => undefined))
    return next
  }

  protected async applyChangeNow(changeView: ChangeView.Params): Promise<ChangeView.Res> {
    let { viewId, projectId: _projectId, change } = changeView

    if (isModelChangeOp(change)) {
      return await this.applyModelChange(changeView, change)
    }

    if (change.op === 'change-property') {
      const payload = preparePayload(changeView, this.services)
      const res = changePropertyHandler(payload)
      if (!res) {
        return {
          success: false,
          error: 'No changes to apply',
        }
      }
      const edits = Array.isArray(res) ? res : [res]
      const applyResult = await this.applyRecorded(
        new Map([[payload.doc.textDocument.uri, edits]]),
        this.resolveProjectId(_projectId),
      )
      if (!applyResult.applied) {
        return {
          success: false,
          error: 'Failed to apply text edits',
        }
      }
      return {
        success: true,
        location: null,
        ...applyResult.historyId && { historyId: applyResult.historyId },
      }
    }

    const workspace = this.services.shared.workspace

    try {
      const project = workspace.ProjectsManager.ensureProject(_projectId as ProjectId)
      logger.debug`Applying model change ${change.op} to view ${viewId} in project ${project.id}`
      const lookup = this.locator.locateViewAst(viewId, project.id)
      if (
        !lookup
        && (change.op === 'save-view-snapshot' || change.op === 'reset-manual-layout')
      ) {
        const model = await this.services.likec4.ModelBuilder.computeModel(project.id)
        if (!model.findView(viewId)) {
          throw new Error(`View ${viewId} not found in project ${project.id}`)
        }
      }

      if (change.op === 'save-view-snapshot') {
        invariant(
          viewId === change.layout.id,
          'View ID does not match, expected ' + viewId + ', got ' + change.layout.id,
        )
        const location = await workspace.ManualLayouts.write(project, change.layout)
        return {
          success: true,
          location,
        }
      }

      if (change.op === 'reset-manual-layout') {
        const location = await workspace.ManualLayouts.remove(project, viewId)
        return {
          success: true,
          location,
        }
      }

      if (!lookup) {
        throw new Error(`View ${viewId} not found in project ${project.id}`)
      }
      const textDocument = {
        uri: lookup.doc.textDocument.uri,
        version: lookup.doc.textDocument.version,
      }

      // Convert the view change to text edits
      const { edits, modifiedRange } = this.convertToTextEdit({
        lookup,
        change,
      })
      if (!edits.length) {
        return {
          success: false,
          error: 'No changes to apply',
        }
      }
      // Apply the text edits to the document
      const applyResult = await this.applyRecorded(new Map([[textDocument.uri, edits]]), project.id)
      if (!applyResult.applied) {
        return {
          success: false,
          error: `Failed to apply changes`,
        }
      }

      return {
        success: true,
        location: {
          uri: textDocument.uri,
          range: modifiedRange,
        },
        ...applyResult.historyId && { historyId: applyResult.historyId },
      }
    } catch (err) {
      const error = loggable(
        wrapError(
          err,
          `Failed to apply change ${changeView.change.op} ${changeView.viewId}`,
        ),
      )
      logger.warn(error)
      return {
        success: false,
        error,
      }
    }
  }

  protected convertToTextEdit({ lookup, change }: {
    lookup: ViewLocateResult
    change: Exclude<
      ViewChange,
      ViewChange.SaveViewSnapshot | ViewChange.ResetManualLayout | ViewChange.ChangeProperty | ModelChangeOp
    >
  }): {
    modifiedRange: Range
    edits: TextEdit[]
  } {
    switch (change.op) {
      case 'change-element-style': {
        return changeElementStyle(this.services, {
          ...lookup,
          targets: change.targets,
          style: change.style,
        })
      }
      case 'change-autolayout': {
        const edit = changeViewLayout(this.services, {
          ...lookup,
          layout: change.layout,
        })
        return {
          modifiedRange: edit.range,
          edits: [edit],
        }
      }
      default:
        nonexhaustive(change)
    }
  }

  protected async applyModelChange(
    { viewId, projectId }: ChangeView.Params,
    change: ModelChangeOp,
  ): Promise<ChangeView.Res> {
    try {
      const project = this.services.shared.workspace.ProjectsManager.ensureProject(projectId as ProjectId)
      logger.debug`Applying model change ${change.op} in view ${viewId} of project ${project.id}`
      const lookup = this.locator.locateViewAst(viewId, project.id)
      if (!lookup) {
        throw new ModelChangeError('not-found', `View ${viewId} not found`)
      }
      const model = await this.services.likec4.ModelBuilder.parseModel(project.id)
      if (!model) {
        throw new ModelChangeError('not-found', `Project ${project.id} has no model`)
      }
      let plan: ModelChangePlan
      switch (change.op) {
        case 'add-relation': {
          plan = addRelation(this.services, { projectId: project.id, lookup, model, change })
          break
        }
        case 'add-element': {
          plan = addElement(this.services, { projectId: project.id, lookup, model, change })
          break
        }
        case 'change-title': {
          plan = changeTitle(this.services, { projectId: project.id, model, change })
          break
        }
        case 'exclude-from-view': {
          plan = excludeFromView({ lookup, model, change })
          break
        }
        case 'delete-from-model': {
          plan = deleteFromModel(this.services, { projectId: project.id, model, change })
          break
        }
        case 'add-deployment-node': {
          plan = addDeploymentNode(this.services, { projectId: project.id, lookup, model, change })
          break
        }
        case 'add-instance': {
          plan = addInstance(this.services, { projectId: project.id, lookup, model, change })
          break
        }
        case 'add-dynamic-step': {
          plan = addDynamicStep(this.services, { lookup, model, change })
          break
        }
        case 'remove-dynamic-step': {
          plan = removeDynamicStep(this.services, { lookup, model, change })
          break
        }
        case 'rename-element': {
          plan = renameElement(this.services, { projectId: project.id, model, change })
          break
        }
        case 'move-element': {
          plan = moveElement(this.services, { projectId: project.id, lookup, model, change })
          break
        }
        default:
          nonexhaustive(change)
      }
      if (plan.edits.size === 0) {
        return {
          success: false,
          error: 'No changes to apply',
        }
      }
      return await this.applyPlan(plan, project.id, viewId)
    } catch (err) {
      if (err instanceof ModelChangeError) {
        logger.warn`Rejected ${change.op} in view ${viewId}: [${err.code}] ${err.message}`
        return {
          success: false,
          code: err.code,
          error: err.message,
          ...err.modifiedUris && { modifiedUris: err.modifiedUris },
        }
      }
      const error = loggable(wrapError(err, `Failed to apply change ${change.op} ${viewId}`))
      logger.warn(error)
      return {
        success: false,
        error,
      }
    }
  }

  /**
   * Applies the plan, and reverts it if any touched document gained errors.
   * A plan that renames items is also reverted when a reference resolves differently,
   * and the manual layouts of the project follow the renames.
   */
  protected async applyPlan(plan: ModelChangePlan, projectId: ProjectId, viewId: ViewId): Promise<ChangeView.Res> {
    const documents = this.services.shared.workspace.LangiumDocuments
    const renames = plan.renames
    // the project of the change, and the projects importing from it that the change touches
    const projects = [...new Set([projectId, ...[...plan.edits.keys()].map(uri => this.ownerProject(uri))])]
    const baseline = renames && {
      references: resolvedReferences(this.services, projects),
      views: await this.viewsOf(projectId),
    }
    const before = new Map<string, { text: string; errors: string[] }>()
    for (const uri of plan.edits.keys()) {
      const doc = documents.getDocument(URI.parse(uri))
      if (!doc) {
        throw new ModelChangeError('not-found', `Document ${uri} not found`)
      }
      before.set(uri, {
        text: doc.textDocument.getText(),
        errors: errorsOf(doc),
      })
    }

    const result = await this.applyWorkspaceEdits(plan.edits)
    if (!result.applied) {
      throw new ModelChangeError('apply-failed', `Failed to apply changes: ${result.reason}`)
    }

    for (const [uri, prev] of before) {
      const errors = errorsOf(documents.getDocument(URI.parse(uri)))
      if (errors.length > prev.errors.length) {
        const newError = errors.find(e => !prev.errors.includes(e)) ?? errors[0]!
        const reverted = await this.revert(before)
        if (!reverted.applied) {
          throw new ModelChangeError(
            'apply-failed',
            `Change has errors and could not be reverted (${reverted.reason}): ${newError}`,
            [...before.keys()],
          )
        }
        throw new ModelChangeError('invalid-result', `Change reverted: ${newError}`, [...before.keys()])
      }
    }

    let viewIds = new Map<ViewId, ViewId>()
    let snapshots: SnapshotChange[] = []
    if (renames && baseline) {
      const broken = brokenReference(
        baseline.references,
        resolvedReferences(this.services, projects),
        renames,
        projectId,
      )
      if (broken) {
        const reverted = await this.revert(before)
        if (!reverted.applied) {
          throw new ModelChangeError(
            'apply-failed',
            `Change breaks ${broken} and could not be reverted (${reverted.reason})`,
            [...before.keys()],
          )
        }
        throw new ModelChangeError('invalid-result', `The change would break ${broken}`, [...before.keys()])
      }
      viewIds = viewIdChanges(baseline.views, await this.viewsOf(projectId), renames)
      for (const project of projects) {
        snapshots.push(
          ...project === projectId
            ? await this.renameInSnapshots(project, renames, viewIds)
            // in other projects the elements of this project have global ids (`@project.fqn`)
            : await this.renameInSnapshots(
              project,
              { elements: globalRenames(projectId, renames.elements) },
              new Map(),
            ),
        )
      }
    }

    const historyId = this.recordHistory(projectId, before, plan.edits, snapshots)

    return {
      success: true,
      location: plan.modifiedRange,
      modifiedUris: [...plan.edits.keys()],
      ...historyId && { historyId },
      ...plan.created && { created: plan.created },
      ...viewIds.has(viewId) && { viewId: viewIds.get(viewId) },
    }
  }

  protected ownerProject(uri: string): ProjectId {
    return this.services.shared.workspace.ProjectsManager.ownerProjectId(URI.parse(uri))
  }

  /**
   * Element views with their `viewOf`, to follow views whose id changes with a rename
   */
  protected async viewsOf(projectId: ProjectId): Promise<ViewOf[]> {
    const model = await this.services.likec4.ModelBuilder.parseModel(projectId)
    return Object.values(model?.$data.views ?? {}).map(view => ({
      id: view.id,
      viewOf: 'viewOf' in view ? view.viewOf ?? null : null,
    }))
  }

  /**
   * Rewrites the manual-layout snapshots of the project after a rename (ADR-002)
   */
  protected async renameInSnapshots(
    projectId: ProjectId,
    renames: FqnRenames,
    viewIds: Map<ViewId, ViewId>,
  ): Promise<SnapshotChange[]> {
    const workspace = this.services.shared.workspace
    const project = workspace.ProjectsManager.getProject(projectId)
    const snapshots = await workspace.ManualLayouts.read(project)
    const changes: SnapshotChange[] = []
    for (const view of Object.values(snapshots?.views ?? {})) {
      const renamed = renameFqnsInSnapshot(view, renames)
      const id = viewIds.get(view.id) ?? view.id
      if (renamed === view && id === view.id) {
        continue
      }
      await workspace.ManualLayouts.write(project, { ...renamed, id })
      if (id === view.id) {
        changes.push({ projectId, viewId: id, before: view, after: renamed })
      } else {
        await workspace.ManualLayouts.remove(project, view.id)
        changes.push({ projectId, viewId: view.id, before: view, after: null })
        changes.push({ projectId, viewId: id, before: null, after: { ...renamed, id } })
      }
    }
    return changes
  }

  protected resolveProjectId(projectId: string | undefined): ProjectId {
    return this.services.shared.workspace.ProjectsManager.ensureProject(projectId as ProjectId).id
  }

  /**
   * Applies text edits and records them in the history
   */
  protected async applyRecorded(
    edits: Map<string, TextEdit[]>,
    projectId: ProjectId,
  ): Promise<{ applied: true; historyId: string | null } | { applied: false; reason: string }> {
    const documents = this.services.shared.workspace.LangiumDocuments
    const before = new Map<string, { text: string }>()
    for (const uri of edits.keys()) {
      const text = documents.getDocument(URI.parse(uri))?.textDocument.getText()
      if (text !== undefined) {
        before.set(uri, { text })
      }
    }
    const result = await this.applyWorkspaceEdits(edits)
    if (!result.applied) {
      return result
    }
    return { applied: true, historyId: this.recordHistory(projectId, before, edits) }
  }

  /**
   * Undo history of model changes per project (canvas undo, in the dev server and in VSCode)
   */
  private history = new Map<ProjectId, { undo: HistoryEntry[]; redo: HistoryEntry[] }>()

  protected historyOf(projectId: ProjectId) {
    let history = this.history.get(projectId)
    if (!history) {
      history = { undo: [], redo: [] }
      this.history.set(projectId, history)
    }
    return history
  }

  private historySeq = 0

  /**
   * Maximum size of the texts kept in the undo history of a project (characters)
   */
  public historyMaxSize = HISTORY_MAX_SIZE

  /**
   * Records the change in the history of the project and returns its id.
   * Texts after the change are computed from the edits: with LSP connection the documents
   * are updated by the client asynchronously, so they may not reflect the change yet.
   */
  protected recordHistory(
    projectId: ProjectId,
    before: Map<string, { text: string }>,
    edits: Map<string, TextEdit[]>,
    snapshots: SnapshotChange[] = [],
  ): string {
    const files = [...before].map(([uri, { text }]) => ({
      uri,
      before: text,
      after: TextDocument.applyEdits(TextDocument.create(uri, 'likec4', 0, text), edits.get(uri) ?? []),
    }))
    const history = this.historyOf(projectId)
    const id = `h${++this.historySeq}`
    history.undo.push({ id, files, ...snapshots.length > 0 && { snapshots } })
    history.redo = []
    let size = history.undo.reduce((total, entry) => total + entrySize(entry), 0)
    while (history.undo.length > 1 && (history.undo.length > HISTORY_LIMIT || size > this.historyMaxSize)) {
      size -= entrySize(history.undo.shift()!)
    }
    return id
  }

  /**
   * Reverts the latest model change of the project
   */
  public undo(params: UndoRedoParams): Promise<ChangeView.Res> {
    return this.enqueue(params.projectId, () => this.restore(params, 'undo'))
  }

  /**
   * Re-applies the latest reverted model change of the project
   */
  public redo(params: UndoRedoParams): Promise<ChangeView.Res> {
    return this.enqueue(params.projectId, () => this.restore(params, 'redo'))
  }

  protected async restore(
    { projectId, historyId }: UndoRedoParams,
    direction: 'undo' | 'redo',
  ): Promise<ChangeView.Res> {
    const project = this.services.shared.workspace.ProjectsManager.ensureProject(projectId as ProjectId)
    const history = this.historyOf(project.id)
    const [from, to] = direction === 'undo' ? [history.undo, history.redo] : [history.redo, history.undo]
    const top = from.at(-1)
    if (!top) {
      return {
        success: false,
        code: 'not-found',
        error: direction === 'undo' ? 'Nothing to undo' : 'Nothing to redo',
      }
    }
    // The change was not the latest one (e.g. another client changed the project since)
    if (historyId && top.id !== historyId) {
      return {
        success: false,
        code: 'stale-undo',
        error: `Another change was made since this edit; ${direction} unavailable`,
      }
    }
    const entry = from.pop()!
    const documents = this.services.shared.workspace.LangiumDocuments
    const texts = new Map<string, { text: string }>()
    for (const file of entry.files) {
      const current = documents.getDocument(URI.parse(file.uri))?.textDocument.getText()
      const expected = direction === 'undo' ? file.after : file.before
      if (current !== expected) {
        // The entry can not be applied anymore, drop it (older entries stay available)
        return {
          success: false,
          code: 'stale-undo',
          error: `File changed since this edit; ${direction} unavailable`,
        }
      }
      texts.set(file.uri, { text: direction === 'undo' ? file.before : file.after })
    }
    const result = await this.revert(texts)
    if (!result.applied) {
      from.push(entry)
      return {
        success: false,
        code: 'apply-failed',
        error: `Failed to ${direction} change: ${result.reason}`,
      }
    }
    if (entry.snapshots) {
      await this.restoreSnapshots(entry.snapshots, direction)
    }
    to.push(entry)
    const first = entry.files[0]
    return {
      success: true,
      location: first
        ? { uri: first.uri, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } }
        : null,
      modifiedUris: entry.files.map(f => f.uri),
      historyId: entry.id,
    }
  }

  /**
   * Writes back the snapshots of a history entry (removes those that did not exist)
   */
  protected async restoreSnapshots(snapshots: SnapshotChange[], direction: 'undo' | 'redo') {
    const workspace = this.services.shared.workspace
    for (const snapshot of snapshots) {
      const project = workspace.ProjectsManager.getProject(snapshot.projectId)
      const layout = direction === 'undo' ? snapshot.before : snapshot.after
      if (layout) {
        await workspace.ManualLayouts.write(project, layout)
      } else {
        await workspace.ManualLayouts.remove(project, snapshot.viewId)
      }
    }
  }

  /**
   * Restores documents to the given texts
   */
  protected async revert(texts: Map<string, { text: string }>): Promise<ApplyEditsResult> {
    const documents = this.services.shared.workspace.LangiumDocuments
    const edits = new Map<string, TextEdit[]>()
    for (const [uri, { text }] of texts) {
      const doc = documents.getDocument(URI.parse(uri))
      if (!doc) {
        continue
      }
      const current = doc.textDocument
      edits.set(uri, [
        TextEdit.replace(
          { start: { line: 0, character: 0 }, end: current.positionAt(current.getText().length) },
          text,
        ),
      ])
    }
    const result = await this.applyWorkspaceEdits(edits)
    if (!result.applied) {
      logger.error`Failed to revert changes: ${result.reason}`
    }
    return result
  }

  /**
   * Applies text edits to multiple documents at once.
   * With LSP connection (e.g. VSCode) this is a single workspace edit (one undo step),
   * otherwise files are written directly.
   */
  protected async applyWorkspaceEdits(edits: Map<string, TextEdit[]>): Promise<ApplyEditsResult> {
    const lsp = this.services.shared.lsp.Connection
    const workspace = this.services.shared.workspace
    const uris = [...edits.keys()].map(uri => URI.parse(uri))
    if (!lsp) {
      // Written and rebuilt together: the file watcher must not rebuild one of them in between,
      // the documents would be linked against an index where the others are not updated yet
      return await workspace.FileSystemWatcher.exclusive(() => this.writeFiles(edits))
    }
    const applyResult = await lsp.workspace.applyEdit({
      label: `LikeC4 - change view`,
      edit: {
        changes: Object.fromEntries(edits),
      },
    })
    if (!applyResult.applied) {
      const reason = applyResult.failureReason ?? 'unknown reason'
      logger.warn`Failed to apply text edits: ${reason}`
      lsp.window.showErrorMessage(`Failed to apply changes: ${reason}`)
      return { applied: false, reason }
    }
    await workspace.DocumentBuilder.update(uris, [])
    return { applied: true }
  }

  /**
   * Writes the edited files and rebuilds them (no LSP connection: MCP, CLI, vite)
   */
  protected async writeFiles(edits: Map<string, TextEdit[]>): Promise<ApplyEditsResult> {
    const workspace = this.services.shared.workspace
    const written = [] as URI[]
    let failure: string | null = null
    for (const [uri, textEdits] of edits) {
      const doc = workspace.LangiumDocuments.getDocument(URI.parse(uri))
      if (!doc) {
        failure = `Document ${uri} not found`
        break
      }
      const text = TextDocument.applyEdits(doc.textDocument, textEdits)
      try {
        await workspace.FileSystemProvider.writeFile(doc.uri, text)
        written.push(doc.uri)
      } catch (err) {
        failure = err instanceof Error ? err.message : String(err)
        break
      }
    }
    // Rebuild what was written, also when a later write failed
    if (written.length > 0) {
      await workspace.DocumentBuilder.update(written, [])
    }
    return failure ? { applied: false, reason: failure } : { applied: true }
  }
}
