import { type ProjectId, type ViewChange, invariant, nonexhaustive } from '@likec4/core'
import { loggable, wrapError } from '@likec4/log'
import { type LangiumDocument, TextDocument, URI } from 'langium'
import { DiagnosticSeverity, Range, TextEdit } from 'vscode-languageserver-types'
import type { ParsedLikeC4LangiumDocument } from '../ast'
import { logger as mainLogger } from '../logger'
import type { LikeC4ModelLocator, ViewLocateResult } from '../model'
import type { LikeC4Services } from '../module'
import type { ChangeView } from '../protocol'
import type { ModelChangePlan } from './_anchors'
import { addElement } from './addElement'
import { addRelation } from './addRelation'
import { changeElementStyle } from './changeElementStyle'
import { changeViewLayout } from './changeViewLayout'
import { ModelChangeError } from './ModelChangeError'
import { changePropertyHandler, preparePayload } from './viewChange'

const logger = mainLogger.getChild('model-changes')

/**
 * Changes that modify the model (not only the view)
 */
type ModelChangeOp = ViewChange.AddRelation | ViewChange.AddElement

const isModelChangeOp = (change: ViewChange): change is ModelChangeOp =>
  change.op === 'add-relation' || change.op === 'add-element'

type ApplyEditsResult = { applied: true } | { applied: false; reason: string }

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
    const key = changeView.projectId ?? ''
    const next = (this.queues.get(key) ?? Promise.resolve()).then(() => this.applyChangeNow(changeView))
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
      const applyResult = await this.applyTextEdits(payload.doc, edits)
      if (!applyResult) {
        return {
          success: false,
          error: 'Failed to apply text edits',
        }
      }
      return {
        success: true,
        location: null,
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
      const applyResult = await this.applyTextEdits(lookup.doc, edits)
      if (!applyResult) {
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
        default:
          nonexhaustive(change)
      }
      return await this.applyPlan(plan)
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
  protected async applyPlan(plan: ModelChangePlan): Promise<ChangeView.Res> {
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
        await this.revert(before)
        throw new ModelChangeError('invalid-result', `Change reverted: ${newError}`)
      }
    }

    return {
      success: true,
      location: plan.modifiedRange,
    }
  }

  /**
   * Restores documents to the given texts
   */
  protected async revert(texts: Map<string, { text: string }>): Promise<void> {
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
  }

  protected async applyTextEdits(doc: ParsedLikeC4LangiumDocument, edits: TextEdit[]): Promise<boolean> {
    const result = await this.applyWorkspaceEdits(new Map([[doc.textDocument.uri, edits]]))
    return result.applied
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
      for (const [uri, textEdits] of edits) {
        const doc = workspace.LangiumDocuments.getDocument(URI.parse(uri))
        if (!doc) {
          return { applied: false, reason: `Document ${uri} not found` }
        }
        const text = TextDocument.applyEdits(doc.textDocument, textEdits)
        await workspace.FileSystemProvider.writeFile(doc.uri, text)
      }
      await workspace.DocumentBuilder.update(uris, [])
      return { applied: true }
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
