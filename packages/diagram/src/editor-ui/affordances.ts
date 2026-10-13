/**
 * Editing affordances on the canvas.
 * Nothing is editable when the diagram is read-only (static builds, locked editor) or in the graph variant.
 */
export function editorAffordances({ enableReadOnly, isGraphVariant, viewType }: {
  enableReadOnly: boolean
  isGraphVariant: boolean
  viewType: 'element' | 'deployment' | 'dynamic'
}): { nodesConnectable: boolean; titlesEditable: boolean; itemsCreatable: boolean } {
  const editable = !enableReadOnly && !isGraphVariant
  return {
    // Connecting nodes creates relations in element views, steps in dynamic views
    nodesConnectable: editable && viewType !== 'deployment',
    // Titles can be edited in element and deployment views
    titlesEditable: editable && viewType !== 'dynamic',
    // Palette (create elements / deployment nodes) in element and deployment views
    itemsCreatable: editable && viewType !== 'dynamic',
  }
}
