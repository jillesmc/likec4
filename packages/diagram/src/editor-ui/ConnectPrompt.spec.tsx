import { Builder } from '@likec4/core/builder'
import type { ViewChange } from '@likec4/core/types'
import { Fqn } from '@likec4/core/types'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { connectChange, ConnectPrompt, stepChange } from './ConnectPrompt'
import { relationshipKinds } from './palette'
import { removeStepChangesOf, stepPositions } from './steps'

const noop = () => {}
const base: ViewChange.AddRelation = { op: 'add-relation', source: Fqn('api'), target: Fqn('queue') }

describe('ConnectPrompt', () => {
  const { builder, model: { model, system } } = Builder.forSpecification({
    elements: { system: {} },
    relationships: { async: {}, sync: {} },
  })
  const kinds = relationshipKinds(builder.with(model(system('api'))).toLikeC4Model())

  it('UT-213: lists "no kind" and the declared relationship kinds', () => {
    expect(kinds).toEqual(['async', 'sync'])
    const html = renderToStaticMarkup(<ConnectPrompt kinds={kinds} onConfirm={noop} onCancel={noop} />)
    const options = [...html.matchAll(/<option value="([^"]*)"/g)].map(m => m[1])
    expect(options).toEqual(['', 'async', 'sync'])
    expect(html).toContain('aria-label="Relation title"')
    expect(html).toContain('aria-label="Relation technology"')
  })

  it('UT-213: has no kind field without declared kinds', () => {
    const html = renderToStaticMarkup(<ConnectPrompt kinds={[]} onConfirm={noop} onCancel={noop} />)
    expect(html).not.toContain('aria-label="Relation kind"')
  })

  it('UT-214: empty fields create the plain relation', () => {
    expect(connectChange(base, { title: ' ', kind: '', technology: '', position: '' }, kinds)).toEqual(base)
  })

  it('UT-214: filled fields are sent, trimmed', () => {
    expect(connectChange(base, { title: ' publishes ', kind: 'async', technology: 'Kafka ', position: '' }, kinds))
      .toEqual({
        ...base,
        title: 'publishes',
        kind: 'async',
        technology: 'Kafka',
      })
  })

  it('UT-214: a kind that is not declared is not sent', () => {
    expect(connectChange(base, { title: '', kind: 'removed', technology: '', position: '' }, kinds)).toEqual(base)
  })
})

describe('dynamic steps', () => {
  const edges = [
    { id: 'step-01', source: 'web', target: 'api' },
    { id: 'step-02:par.01', source: 'api', target: 'db' },
    { id: 'step-02:par.02', source: 'api', target: 'web' },
    { id: 'step-03', source: 'db', target: 'web' },
  ]
  const titleOf = (id: string) => id.toUpperCase()
  const positions = stepPositions(edges, titleOf)
  const stepBase: ViewChange.AddDynamicStep = { op: 'add-dynamic-step', source: Fqn('web'), target: Fqn('db') }

  it('UT-232: one position per top-level step, blocks count as one', () => {
    expect(positions).toEqual([
      { step: 'step-01', label: 'Before step 1: WEB → API' },
      { step: 'step-02:par.01', label: 'Before step 2 (block)' },
      { step: 'step-03', label: 'Before step 3: DB → WEB' },
    ])
    const html = renderToStaticMarkup(
      <ConnectPrompt kinds={[]} positions={positions} onConfirm={noop} onCancel={noop} />,
    )
    const options = [...html.matchAll(/<option value="([^"]*)"/g)].map(m => m[1])
    expect(options).toEqual(['', 'step-01', 'step-02:par.01', 'step-03'])
    expect(html).toContain('At the end')
    expect(html).not.toContain('aria-label="Relation technology"')
  })

  it('UT-233: no position field without steps', () => {
    const html = renderToStaticMarkup(<ConnectPrompt kinds={[]} positions={[]} onConfirm={noop} onCancel={noop} />)
    expect(html).not.toContain('aria-label="Step position"')
    expect(html).toContain('aria-label="Step title"')
  })

  it('UT-232: the chosen position and title are sent, the default appends', () => {
    expect(stepChange(stepBase, { title: '', kind: '', technology: '', position: '' }, positions)).toEqual(stepBase)
    expect(stepChange(stepBase, { title: ' calls ', kind: '', technology: '', position: 'step-03' }, positions))
      .toEqual({ ...stepBase, title: 'calls', beforeStep: 'step-03' })
  })

  it('UT-245: deleting step edges removes them, last first; other edges are ignored', () => {
    expect(removeStepChangesOf([{ id: 'step-01' }, { id: 'step-03' }, { id: 'edge-x' }])).toEqual([
      { op: 'remove-dynamic-step', step: 'step-03' },
      { op: 'remove-dynamic-step', step: 'step-01' },
    ])
  })
})
