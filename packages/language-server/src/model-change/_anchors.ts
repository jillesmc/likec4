import { type FqnRenames, invariant, nonNullable } from '@likec4/core'
import { type CstNode, type TextDocument, GrammarUtils } from 'langium'
import { last } from 'remeda'
import type { Location, Range, TextEdit } from 'vscode-languageserver-types'

const { findNodeForKeyword } = GrammarUtils

/**
 * Text edits planned by a model change handler, possibly spanning multiple documents
 */
export interface ModelChangePlan {
  edits: Map<string, TextEdit[]>
  modifiedRange: Location
  /**
   * Fqn of the item created by the change, if any
   */
  created?: string
  /**
   * Old → new FQNs when the change renames or moves items:
   * references must keep their targets, manual layouts follow
   */
  renames?: FqnRenames
}

/**
 * Adds an anchored edit to the plan
 */
export function addToPlan(plan: ModelChangePlan, uri: string, { edit }: AnchoredEdit): void {
  const edits = plan.edits.get(uri)
  if (edits) {
    edits.push(edit)
  } else {
    plan.edits.set(uri, [edit])
  }
}

export interface AnchoredEdit {
  edit: TextEdit
  /**
   * Range of the inserted content (after the edit is applied)
   */
  range: Range
}

/**
 * End-of-line sequence used by the document
 */
export function eolOf(doc: TextDocument): string {
  return doc.getText().includes('\r\n') ? '\r\n' : '\n'
}

/**
 * Leading whitespace of the given line
 */
export function lineIndent(doc: TextDocument, line: number): string {
  const text = doc.getText({ start: { line, character: 0 }, end: { line, character: Number.MAX_SAFE_INTEGER } })
  return /^[\t ]*/.exec(text)?.[0] ?? ''
}

/**
 * Indentation unit of the document: leading whitespace of the first indented line,
 * or two spaces when nothing is indented
 */
export function indentUnit(doc: TextDocument): string {
  for (let line = 0; line < doc.lineCount; line++) {
    const indent = lineIndent(doc, line)
    if (indent.length > 0) {
      return indent.startsWith('\t') ? '\t' : indent
    }
  }
  return '  '
}

/**
 * Single-quoted DSL string literal
 */
export function quote(value: string): string {
  return `'${value.replaceAll('\\', '\\\\').replaceAll('\'', '\\\'')}'`
}

function insertion(
  doc: TextDocument,
  position: Range['start'],
  prefix: string,
  lines: string[],
  childIndent: string,
  suffix: string,
): AnchoredEdit {
  const eol = eolOf(doc)
  return {
    edit: {
      range: { start: position, end: position },
      // blank lines stay blank
      newText: prefix + lines.map(l => l === '' ? '' : childIndent + l).join(eol) + suffix,
    },
    range: {
      start: { line: position.line + 1, character: childIndent.length },
      end: {
        line: position.line + lines.length,
        character: childIndent.length + (last(lines)?.length ?? 0),
      },
    },
  }
}

/**
 * Inserts lines as the last entries of a `{ ... }` block.
 *
 * @param owner CST node whose line indentation is the base indentation of the block (e.g. element or view)
 * @param block CST node that contains the braces (e.g. element body)
 */
export function appendToBlock(doc: TextDocument, owner: CstNode, block: CstNode, lines: string[]): AnchoredEdit {
  const opening = nonNullable(findNodeForKeyword(block, '{'), 'cant find opening brace')
  const closing = nonNullable(findNodeForKeyword(block, '}'), 'cant find closing brace')
  invariant(closing.container, 'Closing brace has no container')
  const siblings = closing.container.content
  const anchor = nonNullable(siblings[siblings.indexOf(closing) - 1], 'anchor is not defined')

  const eol = eolOf(doc)
  const baseIndent = lineIndent(doc, owner.range.start.line)
  // Copy indentation of the first entry, that starts on its own line
  const firstOwnLine = siblings.find(n =>
    n !== opening && n !== closing && n.range.start.line > opening.range.start.line
  )
  const childIndent = firstOwnLine
    ? lineIndent(doc, firstOwnLine.range.start.line)
    : baseIndent + indentUnit(doc)

  const position = anchor.range.end
  if (closing.range.start.line !== position.line) {
    return insertion(doc, position, eol, lines, childIndent, '')
  }
  // Keep `}` on its own line, replacing whitespace before it
  const res = insertion(doc, position, eol, lines, childIndent, eol + baseIndent)
  res.edit.range.end = closing.range.start
  return res
}

/**
 * Adds a body with the given lines to a node that has none, e.g. `a = system 'A'` → `a = system 'A' { ... }`
 */
export function appendBody(doc: TextDocument, owner: CstNode, lines: string[]): AnchoredEdit {
  const eol = eolOf(doc)
  const baseIndent = lineIndent(doc, owner.range.start.line)
  return insertion(doc, owner.range.end, ' {' + eol, lines, baseIndent + indentUnit(doc), eol + baseIndent + '}')
}

/**
 * Appends a new top-level block (e.g. `model { ... }`) at the end of the document
 */
export function appendTopLevelBlock(doc: TextDocument, keyword: string, lines: string[]): AnchoredEdit {
  const eol = eolOf(doc)
  const text = doc.getText()
  const end = doc.positionAt(text.length)
  const prefix = (text.length === 0 || text.endsWith('\n') ? '' : eol) + eol + keyword + ' {' + eol
  const res = insertion(doc, end, prefix, lines, indentUnit(doc), eol + '}' + eol)
  // inserted lines start after the prefix lines
  const shift = prefix.split(eol).length - 2
  res.range.start.line += shift
  res.range.end.line += shift
  return res
}

/**
 * Removes the node. When it occupies whole lines, the lines are removed,
 * and a blank line left between two blank lines is removed too.
 */
export function removeNode(doc: TextDocument, node: CstNode): AnchoredEdit {
  const { start, end } = node.range
  const lineText = (line: number) =>
    doc.getText({ start: { line, character: 0 }, end: { line, character: Number.MAX_SAFE_INTEGER } })
  const before = lineText(start.line).slice(0, start.character)
  const after = lineText(end.line).slice(end.character)
  if (before.trim() !== '' || after.trim() !== '') {
    return { edit: { range: node.range, newText: '' }, range: { start, end: start } }
  }
  let lastLine = end.line
  const isBlank = (line: number) => line >= 0 && line < doc.lineCount && lineText(line).trim() === ''
  if (isBlank(start.line - 1) && isBlank(end.line + 1)) {
    lastLine++
  }
  const from = { line: start.line, character: 0 }
  const to = lastLine + 1 < doc.lineCount
    ? { line: lastLine + 1, character: 0 }
    : { line: lastLine, character: lineText(lastLine).length }
  return { edit: { range: { start: from, end: to }, newText: '' }, range: { start: from, end: from } }
}

/**
 * Inserts lines right after the node, on new lines with the indentation of the node
 */
export function insertAfterNode(doc: TextDocument, node: CstNode, lines: string[]): AnchoredEdit {
  const indent = lineIndent(doc, node.range.start.line)
  return insertion(doc, node.range.end, eolOf(doc), lines, indent, '')
}

/**
 * Inserts lines before the line of the node, with the indentation of the node
 */
export function insertBeforeNode(doc: TextDocument, node: CstNode, lines: string[]): AnchoredEdit {
  const eol = eolOf(doc)
  const indent = lineIndent(doc, node.range.start.line)
  const position = { line: node.range.start.line, character: 0 }
  return {
    edit: {
      range: { start: position, end: position },
      newText: lines.map(l => indent + l + eol).join(''),
    },
    range: {
      start: { line: position.line, character: indent.length },
      end: { line: position.line + lines.length - 1, character: indent.length + (last(lines)?.length ?? 0) },
    },
  }
}
