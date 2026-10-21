import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { IDENTIFIER_TAKEN, identifierError, INVALID_IDENTIFIER } from './identifier'
import { isRenameHotkey, RenameButton, RenameProvider, renameTargetOf } from './rename'
import { titleKeyAction, TitlePrompt } from './TitlePrompt'

const noop = () => {}
const key = (k: string, mods: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey', boolean>> = {}) => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...mods,
})

describe('rename', () => {
  it('UT-060: F2 opens the prompt outside of text fields only', () => {
    expect(isRenameHotkey(key('F2'), null)).toBe(true)
    expect(isRenameHotkey(key('F2', { ctrlKey: true }), null)).toBe(false)
    expect(isRenameHotkey(key('F3'), null)).toBe(false)
    expect(isRenameHotkey(key('F2'), { tagName: 'INPUT' })).toBe(false)
    expect(isRenameHotkey(key('F2'), { tagName: 'DIV', isContentEditable: true })).toBe(false)
    expect(isRenameHotkey(key('F2'), { tagName: 'DIV', isContentEditable: false })).toBe(true)
  })

  it('UT-061: the prompt shows why the identifier can not be used, and Enter does nothing', () => {
    const taken = new Set(['db'])
    const validate = (value: string) => identifierError(value, taken)
    const render = (name: string) =>
      renderToStaticMarkup(
        <TitlePrompt
          label="Identifier"
          initialTitle={name}
          confirmLabel="Rename"
          validate={validate}
          onConfirm={noop}
          onCancel={noop} />,
      )
    expect(render('1abc')).toContain(INVALID_IDENTIFIER)
    expect(render('db')).toContain(IDENTIFIER_TAKEN)
    expect(render('db')).toMatch(/<button type="button" disabled="">Rename<\/button>/)
    expect(render('gateway')).not.toContain('role="alert"')
    expect(render('gateway')).toMatch(/<button type="button">Rename<\/button>/)
    // the validation result decides whether Enter confirms
    expect(titleKeyAction('Enter', 'db', undefined, validate('db') === null)).toBeNull()
  })

  it('UT-062: Enter confirms a valid identifier, Escape cancels', () => {
    expect(titleKeyAction('Enter', 'gateway', undefined, true)).toBe('confirm')
    expect(titleKeyAction('Escape', 'gateway', undefined, true)).toBe('cancel')
  })

  it('UT-063: only elements of this project can be renamed', () => {
    const node = (type: string, data: object) => ({ type, data })
    expect(renameTargetOf(node('element', { modelFqn: 'cloud.api' }))).toEqual({ element: 'cloud.api' })
    expect(renameTargetOf(node('compound-element', { modelFqn: 'cloud' }))).toEqual({ element: 'cloud' })
    // imported from another project
    expect(renameTargetOf(node('element', { modelFqn: '@other.api' }))).toBeNull()
    // deployment nodes and instances rename themselves, not their element
    expect(renameTargetOf(node('deployment', { modelFqn: 'cloud.api', deploymentFqn: 'prod.api' })))
      .toEqual({ deployment: 'prod.api' })
    expect(renameTargetOf(node('compound-deployment', { deploymentFqn: 'prod' }))).toEqual({ deployment: 'prod' })
    expect(renameTargetOf(null)).toBeNull()
  })

  it('UT-063: the toolbar button is absent when renaming is not available (read-only)', () => {
    const render = (rename: ((id: string) => void) | null) =>
      renderToStaticMarkup(
        <MantineProvider>
          <RenameProvider value={rename}>
            <RenameButton nodeId="cloud.api" />
          </RenameProvider>
        </MantineProvider>,
      )
    expect(render(null)).not.toContain('Rename identifier')
    expect(render(noop)).toContain('aria-label="Rename identifier"')
  })
})
