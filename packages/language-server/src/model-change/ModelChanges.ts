import { type ProjectId, type ViewChange, invariant, nonexhaustive } from '@likec4/core'
import { loggable, wrapError } from '@likec4/log'
import { type LangiumDocument, TextDocument, URI } from 'langium'
import { DiagnosticSeverity, Range, TextEdit } from 'vscode-languageserver-types'
import { logger as mainLogger } from '../logger'
import type { LikeC4ModelLocator, ViewLocateResult } from '../model'
import type { LikeC4Services } from '../module'
import type { ChangeView, UndoChange } from '../protocol'
import type { ModelChangePlan } from './_anchors'
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

const isModelChangeOp = (change: ViewChange): change is ModelChangeOp =>
  change.op === 'add-relation'
  || change.op === 'add-element'
  || change.op === 'change-title'
  || change.op === 'exclude-from-view'
  || change.op === 'delete-from-model'
  || change.op === 'add-deployment-node'
  || change.op === 'add-instance'
  || change.op === 'add-dynamic-step'

type ApplyEditsResult = { applied: true } | { applied: false; reason: string }

type HistoryEntry = {
  id: string
  files: Array<{ uri: string; before: string; after: string }>
}

const HISTORY_LIMIT = 100
/**
 * Maximum size of the texts kept in the history of a project (characters)
 */
const HISTORY_MAX_SIZE = 20_000_000

type UndoRedoParams = UndoChange.Params

const entrySize = (entry: HistoryEntry) => entry.files.reduce((size, f) => size + f.before.length + f.after.length, 0)

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
          plan = addDynamicStep({ lookup, model, change })
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
      return await this.applyPlan(plan, project.id)
    } catch (err) {
      if (err instanceof ModelChangeError) {
        logger.warn`Rejected ${change.op} in view ${viewId}: [${err.code}] ${err.message}`
        return {
          success: false,
          code: err.code,
          error: err.message,
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
   * Applies the plan, and reverts it if any touched document gained errors
   */
  protected async applyPlan(plan: ModelChangePlan, projectId: ProjectId): Promise<ChangeView.Res> {
    const documents = this.services.shared.workspace.LangiumDocuments
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
          )
        }
        throw new ModelChangeError('invalid-result', `Change reverted: ${newError}`)
      }
    }

    const historyId = this.recordHistory(projectId, before)

    return {
      success: true,
      location: plan.modifiedRange,
      modifiedUris: [...plan.edits.keys()],
      ...historyId && { historyId },
      ...plan.created && { created: plan.created },
    }
  }

  protected resolveProjectId(projectId: string | undefined): ProjectId {
    return this.services.shared.workspace.ProjectsManager.ensureProject(projectId as ProjectId).id
  }

  /**
   * Applies text edits and records them in the history (dev server)
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
    return { applied: true, historyId: this.recordHistory(projectId, before) }
  }

  /**
   * Undo history of model changes per project.
   * Only without LSP connection (dev server), editors (VSCode) have their own undo.
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
   * Records the change in the history of the project and returns its id (null with LSP connection)
   */
  protected recordHistory(projectId: ProjectId, before: Map<string, { text: string }>): string | null {
    if (this.services.shared.lsp.Connection) {
      return null
    }
    const documents = this.services.shared.workspace.LangiumDocuments
    const files = [...before].map(([uri, { text }]) => ({
      uri,
      before: text,
      after: documents.getDocument(URI.parse(uri))?.textDocument.getText() ?? text,
    }))
    const history = this.historyOf(projectId)
    const id = `h${++this.historySeq}`
    history.undo.push({ id, files })
    history.redo = []
    let size = history.undo.reduce((total, entry) => total + entrySize(entry), 0)
    while (history.undo.length > 1 && (history.undo.length > HISTORY_LIMIT || size > this.historyMaxSize)) {
      size -= entrySize(history.undo.shift()!)
    }
    return id
  }

  /**
   * Reverts the latest model change of the project (dev server only)
   */
  public undo(params: UndoRedoParams): Promise<ChangeView.Res> {
    return this.enqueue(params.projectId, () => this.restore(params, 'undo'))
  }

  /**
   * Re-applies the latest reverted model change of the project (dev server only)
   */
  public redo(params: UndoRedoParams): Promise<ChangeView.Res> {
    return this.enqueue(params.projectId, () => this.restore(params, 'redo'))
  }

  protected async restore(
    { projectId, historyId }: UndoRedoParams,
    direction: 'undo' | 'redo',
  ): Promise<ChangeView.Res> {
    if (this.services.shared.lsp.Connection) {
      return {
        success: false,
        code: 'unsupported-in-view',
        error: 'Use the editor undo',
      }
    }
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
    to.push(entry)
    const first = entry.files[0]
    return {
      success: true,
      location: first
        ? { uri: first.uri, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } }
        : null,
      historyId: entry.id,
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
      // fallback to direct file write if LSP connection is not available (e.g. when running in MCP/CLI/vite)
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
}
