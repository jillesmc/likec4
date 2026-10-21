import type { ViewChange } from '@likec4/core'
import { DeploymentFqn, Fqn } from '@likec4/core'
import { type LangiumDocument, CstUtils } from 'langium'
import type { RenameProvider } from 'langium/lsp'
import {
  type Position,
  type Range,
  type RenameParams,
  type TextDocumentPositionParams,
  type WorkspaceEdit,
  ErrorCodes,
  ResponseError,
} from 'vscode-languageserver'
import { ast } from '../ast'
import { ModelChangeError } from '../model-change/ModelChangeError'
import { renameElement } from '../model-change/renameElement'
import type { LikeC4Services } from '../module'
import { projectIdFrom } from '../utils'

type Renameable = ast.Element | ast.DeploymentNode | ast.DeployedInstance

/**
 * F2 in the `.c4` editor: renames elements, deployment nodes and deployed instances with the same
 * reference rewrite as the canvas (`_spec.md` rule 12, ADR-003). Other symbols can't be renamed.
 * The editor applies the edits: no guard, no manual-layout rewrite, no canvas history.
 */
export class LikeC4RenameProvider implements RenameProvider {
  constructor(protected services: LikeC4Services) {}

  /**
   * The item whose name (definition or reference) is at the position, and the range of that name
   */
  protected targetAt(document: LangiumDocument, position: Position): { node: Renameable; range: Range } | null {
    const root = document.parseResult.value.$cstNode
    if (!root) {
      return null
    }
    const offset = document.textDocument.offsetAt(position)
    const leaf = CstUtils.findDeclarationNodeAtOffset(root, offset, this.services.parser.GrammarConfig.nameRegexp)
    if (!leaf) {
      return null
    }
    const node = this.services.references.References.findDeclarations(leaf)
      .find(n => ast.isElement(n) || ast.isDeploymentNode(n) || ast.isDeployedInstance(n))
    if (!ast.isElement(node) && !ast.isDeploymentNode(node) && !ast.isDeployedInstance(node)) {
      return null
    }
    // `this` / `it` and other aliases are not the name
    if (leaf.text !== this.services.references.NameProvider.getName(node)) {
      return null
    }
    return { node, range: leaf.range }
  }

  prepareRename(document: LangiumDocument, params: TextDocumentPositionParams): Range | undefined {
    return this.targetAt(document, params.position)?.range
  }

  async rename(document: LangiumDocument, params: RenameParams): Promise<WorkspaceEdit | undefined> {
    const target = this.targetAt(document, params.position)
    if (!target) {
      return undefined
    }
    const { node } = target
    const projectId = projectIdFrom(node)
    const model = await this.services.likec4.ModelBuilder.parseModel(projectId)
    if (!model) {
      return undefined
    }
    const change: ViewChange.RenameElement = {
      op: 'rename-element',
      target: ast.isElement(node)
        ? { element: Fqn(this.services.likec4.FqnIndex.getFqn(node)) }
        : { deployment: DeploymentFqn(this.services.likec4.DeploymentsIndex.getFqn(node)) },
      name: params.newName,
    }
    try {
      const plan = renameElement(this.services, { projectId, model, change })
      return { changes: Object.fromEntries(plan.edits) }
    } catch (err) {
      if (err instanceof ModelChangeError) {
        throw new ResponseError(ErrorCodes.InvalidParams, err.message)
      }
      throw err
    }
  }
}
