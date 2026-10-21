import { nonNullable, parentFqn } from '@likec4/core'
import { type AstNode, AstUtils } from 'langium'
import { type Range, TextEdit } from 'vscode-languageserver-types'
import { ast } from '../ast'
import type { LikeC4Services } from '../module'

export interface RenamePlan {
  edits: Map<string, TextEdit[]>
  /**
   * Old → new FQNs, for the resolution guard and the manual layouts
   */
  renames: { elements: Map<string, string>; deployments: Map<string, string> }
  /**
   * Where the definition's name is
   */
  nameRange: { uri: string; range: Range }
}

/**
 * Collects edits, at most one per position (a segment can be found through several targets)
 */
class Edits {
  readonly edits = new Map<string, TextEdit[]>()
  private seen = new Set<string>()

  replace(uri: string, range: Range, text: string) {
    const key = `${uri}#${range.start.line}:${range.start.character}`
    if (this.seen.has(key)) {
      return
    }
    this.seen.add(key)
    const edit = TextEdit.replace(range, text)
    const edits = this.edits.get(uri)
    if (edits) {
      edits.push(edit)
    } else {
      this.edits.set(uri, [edit])
    }
  }
}

/**
 * Unnamed instance (`instanceOf cloud.api`) whose name comes from the element referenced by `ref`
 */
function unnamedInstanceOf(ref: AstNode | undefined): ast.DeployedInstance | null {
  const elementRef = ref?.$container
  const instance = elementRef?.$container
  if (ast.isFqnRef(ref) && ast.isElementRef(elementRef) && ast.isDeployedInstance(instance) && !instance.name) {
    return instance
  }
  return null
}

const renamedFqn = (fqn: string, name: string) => {
  const parent = parentFqn(fqn)
  return parent ? `${parent}.${name}` : name
}

/**
 * Renames the references to a node that spell its old name (aliases such as `this` / `it` are not the name)
 */
function referenceRenamer(services: LikeC4Services, edits: Edits, oldName: string, name: string) {
  const documents = services.shared.workspace.LangiumDocuments
  const locator = services.workspace.AstNodeLocator
  const references = services.references.References
  const renameReferences = (target: AstNode, onReference?: (ref: AstNode | undefined) => void) => {
    for (const ref of references.findReferences(target, { includeDeclaration: false })) {
      const source = documents.getDocument(ref.sourceUri)
      if (!source || source.textDocument.getText(ref.segment.range) !== oldName) {
        continue
      }
      edits.replace(ref.sourceUri.toString(), ref.segment.range, name)
      onReference?.(locator.getAstNode(source.parseResult.value, ref.sourcePath))
    }
  }
  return renameReferences
}

/**
 * Plans the rename of an element: its name, and every reference segment that spells the old name.
 * Aliases (`this`, `it`) are not rewritten, their text is not the name.
 * Unnamed instances of the element take the new name: their references are renamed too.
 */
export function planElementRename(services: LikeC4Services, node: ast.Element, name: string): RenamePlan {
  const edits = new Edits()
  const doc = AstUtils.getDocument(node)
  const nameNode = nonNullable(services.references.NameProvider.getNameNode(node), 'element has no name node')
  edits.replace(doc.uri.toString(), nameNode.range, name)

  const fqn = services.likec4.FqnIndex.getFqn(node)
  const renames: RenamePlan['renames'] = {
    elements: new Map([[fqn, renamedFqn(fqn, name)]]),
    deployments: new Map(),
  }
  const renameReferences = referenceRenamer(services, edits, node.name, name)
  renameReferences(node, ref => {
    const instance = unnamedInstanceOf(ref)
    if (instance) {
      const instanceFqn = services.likec4.DeploymentsIndex.getFqn(instance)
      renames.deployments.set(instanceFqn, renamedFqn(instanceFqn, name))
      renameReferences(instance)
    }
  })

  return {
    edits: edits.edits,
    renames,
    nameRange: { uri: doc.uri.toString(), range: nameNode.range },
  }
}

/**
 * Plans the rename of a deployment node or a deployed instance, with every reference to it.
 * An unnamed instance (named after its element) gets the name: `name = instanceOf ...`
 */
export function planDeploymentRename(
  services: LikeC4Services,
  node: ast.DeploymentNode | ast.DeployedInstance,
  name: string,
): RenamePlan {
  const edits = new Edits()
  const doc = AstUtils.getDocument(node)
  const uri = doc.uri.toString()
  const oldName = nonNullable(services.references.NameProvider.getName(node), 'deployment item has no name')
  let nameRange: Range
  if (ast.isDeployedInstance(node) && !node.name) {
    // the name node is the element reference: insert the name before `instanceOf`
    const start = nonNullable(node.$cstNode, 'instance has no cst node').range.start
    nameRange = { start, end: start }
    edits.replace(uri, nameRange, `${name} = `)
  } else {
    nameRange = nonNullable(services.references.NameProvider.getNameNode(node), 'no name node').range
    edits.replace(uri, nameRange, name)
  }
  const fqn = services.likec4.DeploymentsIndex.getFqn(node)
  referenceRenamer(services, edits, oldName, name)(node)
  return {
    edits: edits.edits,
    renames: { elements: new Map(), deployments: new Map([[fqn, renamedFqn(fqn, name)]]) },
    nameRange: { uri, range: nameRange },
  }
}
