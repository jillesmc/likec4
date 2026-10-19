import { type ProjectId, type RelationId, type ViewChange, Fqn, nonNullable } from '@likec4/core'
import type { LikeC4Model } from '@likec4/core/model'
import type { UnknownParsed } from '@likec4/core/types'
import { type CstNode, type TextDocument, GrammarUtils } from 'langium'
import type { TextEdit } from 'vscode-languageserver-types'
import { ast } from '../ast'
import type { LikeC4Services } from '../module'
import { type ModelChangePlan, quote, removeNode } from './_anchors'
import { findDeploymentDefinition, findElementDefinition, findRelation } from './_lookup'
import { ModelChangeError } from './ModelChangeError'

const { findNodeForProperty, findNodesForProperty } = GrammarUtils

export interface ChangeTitleArg {
  projectId: ProjectId
  model: LikeC4Model<UnknownParsed>
  change: ViewChange.ChangeTitle
}

type Titled = ast.Element | ast.DeploymentNode | ast.DeployedInstance

/**
 * CST node of the `title` property in the body, if any
 */
function bodyTitle(node: Titled): CstNode | undefined {
  const prop = node.body?.props.find(p => ast.isElementStringProperty(p) && p.key === 'title')
  return prop?.$cstNode ? findNodeForProperty(prop.$cstNode, 'value') : undefined
}

/**
 * CST node of the positional title, if any
 */
function positionalTitle(node: Titled): CstNode | undefined {
  const cst = nonNullable(node.$cstNode, 'node has no cst')
  return ast.isElement(node) ? findNodesForProperty(cst, 'props')[0] : findNodeForProperty(cst, 'title')
}

/**
 * Where to insert the positional title: after `kind name` / `name = kind` / `instanceOf target`
 */
function insertAfter(node: Titled): CstNode {
  const cst = nonNullable(node.$cstNode, 'node has no cst')
  const candidates = ast.isDeployedInstance(node)
    ? [findNodeForProperty(cst, 'target')]
    : [findNodeForProperty(cst, 'name'), findNodeForProperty(cst, 'kind')]
  const nodes = candidates.filter(n => n !== undefined)
  return nonNullable(
    nodes.sort((a, b) => b.offset + b.length - (a.offset + a.length))[0],
    'cant find title anchor',
  )
}

function titleEdit(textDocument: TextDocument, node: Titled, title: string): TextEdit | null {
  const literal = quote(title)
  const existing = bodyTitle(node) ?? positionalTitle(node)
  if (existing) {
    return existing.text === literal ? null : { range: existing.range, newText: literal }
  }
  const anchor = insertAfter(node).range.end
  return { range: { start: anchor, end: anchor }, newText: ' ' + literal }
}

/**
 * Title edit of a relation: updates the `title` property of the body or the positional title,
 * inserts the positional title after the target, or removes the title when empty
 */
function relationTitleEdit(textDocument: TextDocument, node: ast.Relation, title: string): TextEdit | null {
  const cst = nonNullable(node.$cstNode, 'relation has no cst')
  const property = node.body?.props.find(p => ast.isRelationStringProperty(p) && p.key === 'title')
  const propertyValue = property?.$cstNode ? findNodeForProperty(property.$cstNode, 'value') : undefined
  const positional = findNodeForProperty(cst, 'title')
  const literal = quote(title)
  switch (true) {
    case !!propertyValue && title === '':
      return removeNode(textDocument, nonNullable(property?.$cstNode)).edit
    case !!propertyValue:
      return propertyValue.text === literal ? null : { range: propertyValue.range, newText: literal }
    // the positional description would become the title, keep an empty one
    case !!positional && title === '' && node.description !== undefined:
      return { range: positional.range, newText: `''` }
    case !!positional && title === '': {
      const target = nonNullable(findNodeForProperty(cst, 'target'), 'relation has no target')
      return { range: { start: target.range.end, end: positional.range.end }, newText: '' }
    }
    case !!positional:
      return positional.text === literal ? null : { range: positional.range, newText: literal }
    case title === '':
      return null
    default: {
      const target = nonNullable(findNodeForProperty(cst, 'target'), 'relation has no target')
      return { range: { start: target.range.end, end: target.range.end }, newText: ' ' + literal }
    }
  }
}

function changeRelationTitle(
  services: LikeC4Services,
  { projectId }: ChangeTitleArg,
  id: RelationId,
  title: string,
): ModelChangePlan {
  const definition = findRelation(services, projectId, id)
  // Relations of other projects are not imported, so they are never shown in this project
  if (!definition || !ast.isRelation(definition.node)) {
    throw new ModelChangeError('not-found', `Relation "${id}" not found`)
  }
  const { doc, node } = definition
  const uri = doc.textDocument.uri
  const edit = relationTitleEdit(doc.textDocument, node, title)
  const range = edit?.range ?? nonNullable(node.$cstNode).range
  return { edits: edit ? new Map([[uri, [edit]]]) : new Map(), modifiedRange: { uri, range } }
}

/**
 * Plans the title change of an element, deployment node, deployed instance or relation.
 * Updates the `title` property of the body, or the positional title, or inserts the positional title.
 */
export function changeTitle(services: LikeC4Services, arg: ChangeTitleArg): ModelChangePlan {
  const { projectId, model, change } = arg
  const title = change.title.trim()
  if (typeof change.target === 'object') {
    return changeRelationTitle(services, arg, change.target.relation, title)
  }
  if (title.length === 0) {
    throw new ModelChangeError('invalid-name', 'Title must not be empty')
  }
  const target = Fqn(change.target)
  const definition = findElementDefinition(services, projectId, target)
    ?? findDeploymentDefinition(services, projectId, target)
  if (!definition) {
    if (model.findElement(target)) {
      throw new ModelChangeError('read-only-target', `"${target}" is defined in another project`)
    }
    throw new ModelChangeError('not-found', `Element "${target}" not found`)
  }
  const { doc, node } = definition
  const uri = doc.textDocument.uri
  const edit = titleEdit(doc.textDocument, node, title)
  if (!edit) {
    return { edits: new Map(), modifiedRange: { uri, range: nonNullable(node.$cstNode).range } }
  }
  const start = edit.range.start
  return {
    edits: new Map([[uri, [edit]]]),
    modifiedRange: {
      uri,
      range: { start, end: { line: start.line, character: start.character + edit.newText.length } },
    },
  }
}
