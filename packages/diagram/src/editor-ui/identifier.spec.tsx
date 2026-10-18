import { Builder } from '@likec4/core/builder'
import { DeploymentFqn, Fqn } from '@likec4/core/types'
import { deriveIdentifier } from '@likec4/core/utils'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { IDENTIFIER_TAKEN, identifierError, INVALID_IDENTIFIER, shownIdentifier, takenNames } from './identifier'
import { titleKeyAction, TitlePrompt } from './TitlePrompt'

const model = Builder
  .specification({
    elements: { system: {}, component: {} },
    deployments: { env: {}, vm: {} },
  })
  .model(({ system, component }, _) =>
    _(
      system('cloud').with(
        component('api'),
        component('paymentService'),
      ),
      system('billing'),
    )
  )
  .deployment(({ env, vm, instanceOf }, _) =>
    _(
      env('prod').with(
        vm('worker').with(
          instanceOf('cloud.api'),
        ),
      ),
    )
  )
  .toLikeC4Model()

describe('takenNames', () => {
  it('names of the children of the parent element, or of the roots', () => {
    expect(takenNames(model, { model: 'element', parent: Fqn('cloud') })).toEqual(new Set(['api', 'paymentService']))
    expect(takenNames(model, { model: 'element', parent: null })).toEqual(new Set(['cloud', 'billing']))
  })

  it('names of the children of the parent deployment node, or of the roots', () => {
    expect(takenNames(model, { model: 'deployment', parent: DeploymentFqn('prod.worker') })).toEqual(new Set(['api']))
    expect(takenNames(model, { model: 'deployment', parent: null })).toEqual(new Set(['prod']))
  })
})

describe('identifier field', () => {
  const taken = takenNames(model, { model: 'element', parent: Fqn('cloud') })
  const field = { label: 'Identifier', taken, suggest: (title: string) => deriveIdentifier(title, 'component', taken) }
  const noop = () => {}

  it('UT-201: prefills the suggestion derived from the title', () => {
    const html = renderToStaticMarkup(
      <TitlePrompt
        label="Title"
        initialTitle="New component"
        confirmLabel="Add"
        identifier={field}
        onConfirm={noop}
        onCancel={noop} />,
    )
    expect(html).toContain('aria-label="Identifier"')
    expect(html).toContain('value="newComponent"')
    expect(html).toMatch(/<button type="button">Add<\/button>/)
  })

  it('US-012 EC-1: a taken suggestion gets a numeric suffix', () => {
    expect(field.suggest('Payment Service')).toBe('paymentService2')
  })

  it('UT-202: the suggestion is shown until an identifier is typed, clearing it follows the title again', () => {
    expect(shownIdentifier('', 'paymentService2')).toBe('paymentService2')
    expect(shownIdentifier('payments', 'paymentService2')).toBe('payments')
    expect(shownIdentifier('  ', 'billingApi')).toBe('billingApi')
  })

  it('UT-204: invalid or taken identifiers are refused', () => {
    expect(identifierError('payments', taken)).toBeNull()
    expect(identifierError('9lives', taken)).toBe(INVALID_IDENTIFIER)
    expect(identifierError('billing api', taken)).toBe(INVALID_IDENTIFIER)
    expect(identifierError('api', taken)).toBe(IDENTIFIER_TAKEN)
    // Enter does not confirm while the identifier is refused
    expect(titleKeyAction('Enter', 'API', undefined, false)).toBeNull()
  })

  it('UT-204: shows the error and disables confirm', () => {
    const html = renderToStaticMarkup(
      <TitlePrompt
        label="Title"
        initialTitle="API"
        confirmLabel="Add"
        identifier={{ ...field, suggest: () => 'api' }}
        onConfirm={noop}
        onCancel={noop} />,
    )
    expect(html).toContain(IDENTIFIER_TAKEN)
    expect(html).toMatch(/<button type="button" disabled="">Add<\/button>/)
  })

  it('UT-206: an instance is named after the element, made unique in the node', () => {
    const inNode = takenNames(model, { model: 'deployment', parent: DeploymentFqn('prod.worker') })
    expect(deriveIdentifier('api', 'api', inNode)).toBe('api2')
    const inEnv = takenNames(model, { model: 'deployment', parent: DeploymentFqn('prod') })
    expect(deriveIdentifier('api', 'api', inEnv)).toBe('api')
  })
})
