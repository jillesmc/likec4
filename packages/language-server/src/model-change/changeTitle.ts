import { type ProjectId, type ViewChange, Fqn, nonNullable } from '@likec4/core'
import type { LikeC4Model } from '@likec4/core/model'
import type { UnknownParsed } from '@likec4/core/types'
import { type CstNode, type TextDocument, GrammarUtils } from 'langium'
import type { TextEdit } from 'vscode-languageserver-types'
import { ast } from '../ast'
import type { LikeC4Services } from '../module'
import { type ModelChangePlan, quote } from './_anchors'
import { findDeploymentDefinition, findElementDefinition } from './_lookup'
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
 * Plans the title change of an element, deployment node or deployed instance.
 * Updates the `title` property of the body, or the positional title, or inserts the positional title.
 */
export function changeTitle(services: LikeC4Services, { projectId, model, change }: ChangeTitleArg): ModelChangePlan {
  const title = change.title.trim()
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
