import type { LikeC4Model } from '@likec4/core/model'
import type { aux, DeploymentKind, ElementKind } from '@likec4/core/types'
import { keys } from 'remeda'
import type { PaletteItem } from './ElementPalette'
import { type CanvasDropConfig, INSTANCE_ITEM } from './useCanvasDrop'

export type CanvasPalette = {
  title: string
  emptyMessage: string
  items: PaletteItem[]
  config: CanvasDropConfig
}

/**
 * Palette of the view: element kinds in element views,
 * deployment node kinds and "Instance" in deployment views
 */
export function canvasPalette<A extends aux.Any>(
  viewType: 'element' | 'deployment' | 'dynamic',
  model: LikeC4Model<A>,
): CanvasPalette | null {
  const spec = model.specification
  switch (viewType) {
    case 'element': {
      // keys of specification.elements are element kinds (Object.keys loses the tag)
      const kinds = keys(spec.elements).map(kind => kind as ElementKind)
      return {
        title: 'Elements',
        emptyMessage: 'No element kinds in specification',
        items: kinds.map(kind => ({ kind, label: kind })),
        config: { viewType: 'element', kinds },
      }
    }
    case 'deployment': {
      // keys of specification.deployments are deployment node kinds
      const kinds = keys(spec.deployments).map(kind => kind as DeploymentKind)
      const elements: string[] = [...model.elements()].map(e => e.id)
      const items = kinds.map(kind => ({ kind, label: kind }))
      return {
        title: 'Deployment',
        emptyMessage: 'No deployment node kinds in specification',
        items: elements.length > 0 ? [...items, { kind: INSTANCE_ITEM, label: 'Instance' }] : items,
        config: { viewType: 'deployment', kinds, elements },
      }
    }
    default:
      return null
  }
}
