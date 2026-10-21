import { Builder } from '@likec4/core/builder'
import { Fqn } from '@likec4/core/types'
import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MoveButton, moveParents, MoveProvider, moveTargetOf, TOP_LEVEL } from './move'

const model = Builder
  .specification({ elements: { system: {}, container: {} } })
  .model(({ system, container }, _) =>
    _(
      system('customer'),
      system('cloud').with(
        container('api'),
        container('db').with(
          container('table'),
        ),
      ),
    )
  )
  .toLikeC4Model()

describe('move', () => {
  it('UT-065: lists the top level first, then elements except itself, its descendants and its parent', () => {
    expect(moveParents(model, Fqn('cloud.db'))).toEqual([TOP_LEVEL, 'customer', 'cloud.api'])
    // already at the top level: no "Top level"
    expect(moveParents(model, Fqn('customer'))).toEqual(['cloud', 'cloud.api', 'cloud.db', 'cloud.db.table'])
  })

  it('UT-066: deployment nodes, instances and imported elements are not moved', () => {
    const node = (type: string, data: object) => ({ type, data })
    expect(moveTargetOf(node('element', { modelFqn: 'cloud.db' }))).toBe('cloud.db')
    expect(moveTargetOf(node('compound-element', { modelFqn: 'cloud' }))).toBe('cloud')
    expect(moveTargetOf(node('deployment', { modelFqn: 'cloud.db', deploymentFqn: 'prod.db' }))).toBeNull()
    expect(moveTargetOf(node('compound-deployment', { deploymentFqn: 'prod' }))).toBeNull()
    expect(moveTargetOf(node('element', { modelFqn: '@other.api' }))).toBeNull()
  })

  it('UT-066: the toolbar button is absent when moving is not available', () => {
    const render = (move: ((id: string) => void) | null) =>
      renderToStaticMarkup(
        <MantineProvider>
          <MoveProvider value={move}>
            <MoveButton nodeId="cloud.db" />
          </MoveProvider>
        </MantineProvider>,
      )
    expect(render(null)).not.toContain('Move to')
    expect(render(() => {})).toContain('aria-label="Move to…"')
  })
})
