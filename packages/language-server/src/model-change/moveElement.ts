import { type ProjectId, type ViewChange, Fqn, nameFromFqn, nonNullable, parentFqn } from '@likec4/core'
import type { LikeC4Model } from '@likec4/core/model'
import type { UnknownParsed } from '@likec4/core/types'
import { type AstNode, type CstNode, AstUtils, TextDocument } from 'langium'
import type { Range, TextEdit } from 'vscode-languageserver-types'
import { type ParsedLikeC4LangiumDocument, ast } from '../ast'
import type { ViewLocateResult } from '../model'
import type { LikeC4Services } from '../module'
import {
  type AnchoredEdit,
  type ModelChangePlan,
  addToPlan,
  appendBody,
  appendToBlock,
  appendTopLevelBlock,
  lineIndent,
} from './_anchors'
import { findElementDefinition } from './_lookup'
import { isMovedElementVisible } from './_visibility'
import { ModelChangeError } from './ModelChangeError'

export interface MoveElementArg {
  projectId: ProjectId
  lookup: ViewLocateResult
  model: LikeC4Model<UnknownParsed>
  change: ViewChange.MoveElement
}

type Chain = ast.FqnRef | ast.StrictFqnElementRef

/**
 * The whole reference `a.b.c` that contains the segment node (the segments are nested by `parent`)
 */
function outermostChain(node: AstNode | undefined): Chain | null {
  if (!ast.isFqnRef(node) && !ast.isStrictFqnElementRef(node)) {
    return null
  }
  let chain: Chain = node
  while (
    (ast.isFqnRef(chain.$container) || ast.isStrictFqnElementRef(chain.$container))
    && chain.$containerProperty === 'parent'
  ) {
    chain = chain.$container
  }
  return chain
}

/**
 * The element the whole reference points to (its last segment)
 */
function chainTarget(chain: Chain): AstNode | undefined {
  return ast.isFqnRef(chain) ? chain.value.ref : chain.el.ref
}

const isComment = (line: string) => {
  const text = line.trim()
  return text.startsWith('//') || text.startsWith('/*') || text.startsWith('*') || text.endsWith('*/')
}

/**
 * Lines of the statement, with the comment lines right above it (no blank line between),
 * when the statement is alone on its lines; otherwise its exact range
 */
function statementRange(doc: TextDocument, cst: CstNode): { range: Range; wholeLines: boolean } {
  const lineText = (line: number) =>
    doc.getText({ start: { line, character: 0 }, end: { line, character: Number.MAX_SAFE_INTEGER } })
  const { start, end } = cst.range
  const before = lineText(start.line).slice(0, start.character)
  const after = lineText(end.line).slice(end.character)
  if (before.trim() !== '' || (after.trim() !== '' && !after.trim().startsWith('//'))) {
    return { range: cst.range, wholeLines: false }
  }
  let first = start.line
  while (first > 0 && isComment(lineText(first - 1))) {
    first--
  }
  const to = end.line + 1 < doc.lineCount
    ? { line: end.line + 1, character: 0 }
    : { line: end.line, character: lineText(end.line).length }
  return { range: { start: { line: first, character: 0 }, end: to }, wholeLines: true }
}

/**
 * Plans the move of an element (with its subtree) under another parent, or to the top level:
 * - the statement leaves its block and is appended to the new parent's block (in the parent's file)
 * - references outside the moved block to the moved elements use their new full FQN
 * - qualified references inside the block to the moved elements use their new full FQN,
 *   references inside the block to other elements use the element's full FQN
 * - `include <newFqn>` is appended to the view when the element was visible and would not be anymore
 */
export function moveElement(
  services: LikeC4Services,
  { projectId, lookup, model, change }: MoveElementArg,
): ModelChangePlan {
  const fqn = Fqn(change.element)
  const parent = change.parent === null ? null : Fqn(change.parent)
  const definition = findElementDefinition(services, projectId, fqn)
  if (!definition) {
    if (model.findElement(fqn)) {
      throw new ModelChangeError('read-only-target', `${fqn} is defined in another project`)
    }
    throw new ModelChangeError('not-found', `${fqn} not found`)
  }
  const parentDefinition = parent ? findElementDefinition(services, projectId, parent) : null
  if (parent && !parentDefinition) {
    if (model.findElement(parent)) {
      throw new ModelChangeError('read-only-target', `${parent} is defined in another project`)
    }
    throw new ModelChangeError('not-found', `${parent} not found`)
  }
  if (parent === parentFqn(fqn) || (parent && (parent === fqn || parent.startsWith(fqn + '.')))) {
    throw new ModelChangeError('invalid-parent', `${fqn} cannot be moved into ${parent ?? 'Top level'}`)
  }
  const name = nameFromFqn(fqn)
  const newFqn = Fqn(name, parent)
  if (services.likec4.FqnIndex.byFqn(projectId, newFqn).head()) {
    throw new ModelChangeError('name-collision', `${parent ?? 'Top level'} already has ${name}`)
  }

  const { doc, node } = definition
  const references = services.references.References
  const documents = services.shared.workspace.LangiumDocuments
  const locator = services.workspace.AstNodeLocator
  const fqnIndex = services.likec4.FqnIndex

  // Only top-level elements can be imported: moving one under a parent breaks its imports
  if (!parentFqn(fqn)) {
    const imports = references.findReferences(node, { includeDeclaration: false })
      .filter(ref => {
        const source = documents.getDocument(ref.sourceUri)
        return !!source && ast.isImported(locator.getAstNode(source.parseResult.value, ref.sourcePath))
      })
      .map(ref => `${ref.sourceUri.path.split('/').pop()}:${ref.segment.range.start.line + 1}`)
      .toArray()
    if (imports.length > 0) {
      const places = imports.length === 1 ? '1 place' : `${imports.length} places`
      throw new ModelChangeError('has-references', `${fqn} is imported in ${places}: ${imports.join(', ')}`)
    }
  }

  const renames = new Map([[fqn as string, newFqn as string]])
  const moved = (target: AstNode | undefined): target is ast.Element =>
    ast.isElement(target) && AstUtils.hasContainerOfType(target, n => n === node)
  const newFqnOf = (element: ast.Element) => {
    const old = fqnIndex.getFqn(element)
    return newFqn + old.slice(fqn.length)
  }

  const textDocument = doc.textDocument
  const uri = textDocument.uri
  const cst = nonNullable(node.$cstNode, 'element has no cst node')
  const statement = statementRange(textDocument, cst)
  const startOffset = textDocument.offsetAt(statement.range.start)
  const endOffset = textDocument.offsetAt(statement.range.end)
  const inStatement = (sourceUri: string, offset: number) =>
    sourceUri === uri && offset >= startOffset && offset < endOffset

  const plan: ModelChangePlan = {
    edits: new Map(),
    modifiedRange: { uri, range: statement.range },
    renames: { elements: renames },
  }

  // References outside the moved block, to the moved elements: their new full FQN
  const subtree = AstUtils.streamAst(node).filter(ast.isElement).toArray()
  for (const target of subtree) {
    for (const ref of references.findReferences(target, { includeDeclaration: false })) {
      const source = documents.getDocument(ref.sourceUri)
      if (!source || inStatement(ref.sourceUri.toString(), ref.segment.offset)) {
        continue
      }
      const text = source.textDocument.getText(ref.segment.range)
      if (text === 'this' || text === 'it') {
        continue
      }
      const chain = outermostChain(locator.getAstNode(source.parseResult.value, ref.sourcePath))
      // the whole reference is rewritten once, for the element it points to
      if (!chain?.$cstNode || chainTarget(chain) !== target) {
        continue
      }
      addToPlan(plan, ref.sourceUri.toString(), {
        edit: { range: chain.$cstNode.range, newText: newFqnOf(target) },
        range: chain.$cstNode.range,
      })
    }
  }

  // References inside the moved block: they must resolve from the new place
  const inner: TextEdit[] = []
  for (const child of AstUtils.streamAst(node)) {
    for (const reference of AstUtils.streamReferences(child)) {
      const chain = outermostChain(reference.container)
      if (!chain || chain !== reference.container || !chain.$cstNode) {
        continue
      }
      const target = chainTarget(chain)
      const text = chain.$cstNode.text
      let newText: string | null = null
      switch (true) {
        case text === 'this' || text === 'it':
          break
        case moved(target) || target === node:
          // a short name resolves in the moved block, a qualified one uses the old place
          if ('parent' in chain && chain.parent && ast.isElement(target)) {
            newText = newFqnOf(target)
          }
          break
        case ast.isElement(target): {
          const full = fqnIndex.getFqn(target)
          newText = text === full ? null : full
          break
        }
      }
      if (newText !== null) {
        inner.push({ range: chain.$cstNode.range, newText })
      }
    }
  }

  // The statement, with the inner edits, re-indented relative to its first line
  const edited = TextDocument.create(uri, 'likec4', 0, textDocument.getText())
  const editedText = TextDocument.applyEdits(edited, inner)
  const delta = editedText.length - textDocument.getText().length
  const movedText = editedText.slice(startOffset, endOffset + delta).replace(/\r?\n$/, '')
  const baseIndent = statement.wholeLines ? lineIndent(textDocument, cst.range.start.line) : ''
  const lines = movedText.split(/\r?\n/).map(line =>
    line.trim() === '' ? '' : line.startsWith(baseIndent) ? line.slice(baseIndent.length) : line.trimStart()
  )

  // Remove the statement
  addToPlan(plan, uri, { edit: { range: statement.range, newText: '' }, range: statement.range })

  // Insert it into the new parent's block (or the first model of the view's file)
  let target: { doc: ParsedLikeC4LangiumDocument; anchored: AnchoredEdit }
  if (parentDefinition) {
    const parentCst = nonNullable(parentDefinition.node.$cstNode, 'parent has no cst node')
    const parentDoc = parentDefinition.doc.textDocument
    target = {
      doc: parentDefinition.doc,
      anchored: parentDefinition.node.body?.$cstNode
        ? appendToBlock(parentDoc, parentCst, parentDefinition.node.body.$cstNode, lines)
        : appendBody(parentDoc, parentCst, lines),
    }
  } else {
    const viewDoc = lookup.doc
    const modelCst = viewDoc.parseResult.value.models[0]?.$cstNode
    target = {
      doc: viewDoc,
      anchored: modelCst
        ? appendToBlock(viewDoc.textDocument, modelCst, modelCst, lines)
        : appendTopLevelBlock(viewDoc.textDocument, 'model', lines),
    }
  }
  addToPlan(plan, target.doc.textDocument.uri, target.anchored)
  plan.modifiedRange = { uri: target.doc.textDocument.uri, range: target.anchored.range }

  // shown in the view before the move, hidden after it
  const wasVisible = isMovedElementVisible(model, lookup.view.id, new Map(), fqn)
  if (wasVisible && !isMovedElementVisible(model, lookup.view.id, renames, newFqn)) {
    const viewCst = nonNullable(lookup.viewAst.$cstNode, 'view has no cst node')
    const bodyCst = nonNullable(lookup.viewAst.body?.$cstNode, `view ${lookup.view.id} has no body`)
    addToPlan(
      plan,
      lookup.doc.textDocument.uri,
      appendToBlock(lookup.doc.textDocument, viewCst, bodyCst, [`include ${newFqn}`]),
    )
  }
  return plan
}
