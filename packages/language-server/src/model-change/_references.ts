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

/**
 * Plans the rename of an element: its name, and every reference segment that spells the old name.
 * Aliases (`this`, `it`) are not rewritten, their text is not the name.
 * Unnamed instances of the element take the new name: their references are renamed too.
 */
export function planElementRename(services: LikeC4Services, node: ast.Element, name: string): RenamePlan {
  const documents = services.shared.workspace.LangiumDocuments
  const locator = services.workspace.AstNodeLocator
  const references = services.references.References
  const oldName = node.name
  const edits = new Edits()

  const doc = AstUtils.getDocument(node)
  const nameNode = nonNullable(services.references.NameProvider.getNameNode(node), 'element has no name node')
  edits.replace(doc.uri.toString(), nameNode.range, name)

  const fqn = services.likec4.FqnIndex.getFqn(node)
  const parent = parentFqn(fqn)
  const renames: RenamePlan['renames'] = {
    elements: new Map([[fqn, parent ? `${parent}.${name}` : name]]),
    deployments: new Map(),
  }

  // Renames the references to `target` that spell the old name
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

  renameReferences(node, ref => {
    const instance = unnamedInstanceOf(ref)
    if (instance) {
      const instanceFqn = services.likec4.DeploymentsIndex.getFqn(instance)
      const instanceParent = parentFqn(instanceFqn)
      renames.deployments.set(instanceFqn, instanceParent ? `${instanceParent}.${name}` : name)
      renameReferences(instance)
    }
  })

  return {
    edits: edits.edits,
    renames,
    nameRange: { uri: doc.uri.toString(), range: nameNode.range },
  }
}
