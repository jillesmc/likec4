import { Builder } from '@likec4/core/builder'
import type { ViewChange } from '@likec4/core/types'
import { Fqn } from '@likec4/core/types'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { connectChange, ConnectPrompt } from './ConnectPrompt'
import { relationshipKinds } from './palette'

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
    expect(connectChange(base, { title: ' ', kind: '', technology: '' }, kinds)).toEqual(base)
  })

  it('UT-214: filled fields are sent, trimmed', () => {
    expect(connectChange(base, { title: ' publishes ', kind: 'async', technology: 'Kafka ' }, kinds)).toEqual({
      ...base,
      title: 'publishes',
      kind: 'async',
      technology: 'Kafka',
    })
  })

  it('UT-214: a kind that is not declared is not sent', () => {
    expect(connectChange(base, { title: '', kind: 'removed', technology: '' }, kinds)).toEqual(base)
  })
})
