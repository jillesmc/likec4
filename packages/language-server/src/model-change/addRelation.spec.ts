import type { Fqn, RelationshipKind, ViewId } from '@likec4/core'
import { TextDocument } from 'langium'
import stripIndent from 'strip-indent'
import { describe, expect, it, vi } from 'vitest'
import { createMultiProjectTestServices } from '../test'
import { memfsWorkspace } from './__test__/memfsWorkspace'
import { appendTopLevelBlock } from './_anchors'

vi.mock('node:fs')
vi.mock('node:fs/promises')

const dsl = (text: string) => stripIndent(text).trimStart().trimEnd() + '\n'

const addRelation = (source: string, target: string, viewId = 'index') => ({
  viewId: viewId as ViewId,
  change: {
    op: 'add-relation' as const,
    source: source as Fqn,
    target: target as Fqn,
  },
})

describe('add-relation', () => {
  it('UT-010: appends relation inside the source block, keeping comments', async () => {
    const ws = await memfsWorkspace({
      'model.c4': `
        specification {
          element actor
          element system
          element service
        }
        model {
          // people
          customer = actor 'Customer' {
            description 'A customer'
            // keep me
          }
          cloud = system 'Cloud'
        }
        views {
          view index {
            include *
          }
        }
      `,
    })
    const res = await ws.apply(addRelation('customer', 'cloud'))
    expect(res).toMatchObject({ success: true })
    expect(ws.read('model.c4')).toBe(dsl(`
      specification {
        element actor
        element system
        element service
      }
      model {
        // people
        customer = actor 'Customer' {
          description 'A customer'
          // keep me
          -> cloud
        }
        cloud = system 'Cloud'
      }
      views {
        view index {
          include *
        }
      }
    `))
  })

  it('UT-001: appends after the last child, with the indentation of children', async () => {
    const ws = await memfsWorkspace({
      'model.c4': `
        specification {
          element actor
          element system
          element service
        }
        model {
          cloud = system 'Cloud' {
              api = service
          }
          db = service
        }
        views {
          view index {
            include *
          }
        }
      `,
    })
    await ws.apply(addRelation('cloud', 'db'))
    expect(ws.read('model.c4')).toContain(dsl(`
      model {
        cloud = system 'Cloud' {
            api = service
            -> db
        }
        db = service
      }
    `))
  })

  it('UT-002: adds a body to an element without one', async () => {
    const ws = await memfsWorkspace({
      'model.c4': `
        specification {
          element actor
          element system
          element service
        }
        model {
          customer = actor 'Customer'
          cloud = system 'Cloud'
        }
        views {
          view index {
            include *
          }
        }
      `,
    })
    await ws.apply(addRelation('customer', 'cloud'))
    expect(ws.read('model.c4')).toContain(dsl(`
      model {
        customer = actor 'Customer' {
          -> cloud
        }
        cloud = system 'Cloud'
      }
    `))
  })

  it('UT-003: keeps closing brace on its own line for single-line blocks', async () => {
    const ws = await memfsWorkspace({
      'model.c4': `
        specification {
          element actor
          element system
          element service
        }
        model {
          cloud = system 'Cloud' { api = service }
          db = service
        }
        views {
          view index {
            include *
          }
        }
      `,
    })
    const res = await ws.apply(addRelation('cloud', 'db'))
    expect(res).toMatchObject({ success: true })
    expect(ws.read('model.c4')).toContain(dsl(`
      model {
        cloud = system 'Cloud' { api = service
          -> db
        }
        db = service
      }
    `))
    const doc = ws.services.shared.workspace.LangiumDocuments.getDocument(
      (await import('vscode-uri')).URI.parse(ws.uri('model.c4')),
    )
    expect(doc?.parseResult.parserErrors).toEqual([])
  })

  it('UT-004: uses tabs in tab-indented files', async () => {
    const ws = await memfsWorkspace({
      'model.c4': [
        'specification {',
        '\telement actor',
        '\telement system',
        '}',
        'model {',
        '\tcustomer = actor \'Customer\' {',
        '\t\tdescription \'A customer\'',
        '\t}',
        '\tcloud = system \'Cloud\'',
        '}',
        'views {',
        '\tview index {',
        '\t\tinclude *',
        '\t}',
        '}',
      ].join('\n'),
    })
    await ws.apply(addRelation('customer', 'cloud'))
    expect(ws.read('model.c4')).toContain([
      '\tcustomer = actor \'Customer\' {',
      '\t\tdescription \'A customer\'',
      '\t\t-> cloud',
      '\t}',
    ].join('\n'))
  })

  it('UT-004: keeps CRLF line endings', async () => {
    const ws = await memfsWorkspace({
      'model.c4': [
        'specification {',
        '  element actor',
        '  element system',
        '}',
        'model {',
        '  customer = actor \'Customer\'',
        '  cloud = system \'Cloud\'',
        '}',
        'views {',
        '  view index {',
        '    include *',
        '  }',
        '}',
      ].join('\r\n'),
    })
    await ws.apply(addRelation('customer', 'cloud'))
    expect(ws.read('model.c4')).toContain([
      '  customer = actor \'Customer\' {',
      '    -> cloud',
      '  }',
    ].join('\r\n'))
  })

  it('UT-005: appends a top-level block at the end of a document without one', () => {
    const doc = TextDocument.create('file:///a.c4', 'likec4', 1, 'views {\n  view index {\n  }\n}\n')
    const { edit, range } = appendTopLevelBlock(doc, 'model', ['a -> b'])
    expect(TextDocument.applyEdits(doc, [edit])).toBe(
      'views {\n  view index {\n  }\n}\n\nmodel {\n  a -> b\n}\n',
    )
    expect(range).toEqual({ start: { line: 6, character: 2 }, end: { line: 6, character: 8 } })
  })

  it('UT-006 + UT-030: adds include when the relation is not visible, keeping `}` on its own line', async () => {
    const ws = await memfsWorkspace({
      'model.c4': `
        specification {
          element actor
          element system
          element service
        }
        model {
          customer = actor 'Customer'
          cloud = system 'Cloud'
        }
        views {
          view index { include customer }
        }
      `,
    })
    await ws.apply(addRelation('customer', 'cloud'))
    expect(ws.read('model.c4')).toContain(dsl(`
      views {
        view index { include customer
          include customer -> cloud
        }
      }
    `))
  })

  it('UT-031: does not add include when the relation is visible', async () => {
    const ws = await memfsWorkspace({
      'model.c4': `
        specification {
          element actor
          element system
          element service
        }
        model {
          customer = actor 'Customer'
          cloud = system 'Cloud'
        }
        views {
          view index {
            include *
          }
        }
      `,
    })
    await ws.apply(addRelation('customer', 'cloud'))
    expect(ws.read('model.c4')).not.toContain('include customer -> cloud')
  })

  it('UT-012: writes a second relation when one already exists', async () => {
    const ws = await memfsWorkspace({
      'model.c4': `
        specification {
          element actor
          element system
          element service
        }
        model {
          customer = actor 'Customer' {
            -> cloud
          }
          cloud = system 'Cloud'
        }
        views {
          view index {
            include *
          }
        }
      `,
    })
    await ws.apply(addRelation('customer', 'cloud'))
    expect(ws.read('model.c4')).toContain(
      dsl(`
      customer = actor 'Customer' {
        -> cloud
        -> cloud
      }
    `).replaceAll('\n', '\n  ').trimEnd(),
    )
  })

  it('UT-040: rejects missing target with not-found, without changes', async () => {
    const ws = await memfsWorkspace({
      'model.c4': `
        specification {
          element actor
          element system
          element service
        }
        model {
          customer = actor 'Customer'
        }
        views {
          view index {
            include *
          }
        }
      `,
    })
    const before = ws.read('model.c4')
    const res = await ws.apply(addRelation('customer', 'cloud.ui'))
    expect(res).toEqual({
      success: false,
      code: 'not-found',
      error: 'Element "cloud.ui" not found',
    })
    expect(ws.read('model.c4')).toBe(before)
  })
})

describe('add-relation: applyChange end-to-end', () => {
  const modelFile = `
    specification {
      element actor
      element system
      element service
    }
    model {
      customer = actor 'Customer'
      cloud = system 'Cloud' {
        api = service
      }
    }
  `

  it('IT-001: writes only the source file and the model gets the relation', async () => {
    const ws = await memfsWorkspace({
      'model.c4': modelFile,
      'views.c4': `
        views {
          view index {
            include *
          }
        }
      `,
    })
    const viewsBefore = ws.read('views.c4')
    const res = await ws.apply(addRelation('customer', 'cloud'))
    expect(res).toEqual({
      success: true,
      location: {
        uri: ws.uri('model.c4'),
        range: { start: { line: 7, character: 4 }, end: { line: 7, character: 12 } },
      },
      modifiedUris: [ws.uri('model.c4')],
      historyId: expect.any(String),
    })
    expect(ws.read('views.c4')).toBe(viewsBefore)
    const model = await ws.services.likec4.ModelBuilder.computeModel()
    expect([...model.relationships()].map(r => `${r.source.id} -> ${r.target.id}`)).toEqual(['customer -> cloud'])
    const docs = ws.services.shared.workspace.LangiumDocuments.all.toArray()
    expect(docs.flatMap(d => d.diagnostics ?? []).filter(d => d.severity === 1)).toEqual([])
  })

  it('IT-002 + IT-003: with LSP, applies model edit and include as one workspace edit', async () => {
    const ws = await memfsWorkspace({
      'model.c4': modelFile,
      'views.c4': `
        views {
          view index {
            include customer
          }
        }
      `,
    }, { lsp: true })
    const res = await ws.apply(addRelation('customer', 'cloud'))
    expect(res).toMatchObject({ success: true })
    expect(ws.lsp!.applied).toHaveLength(1)
    // issue 007: all modified documents are reported, so the editor can save them
    expect(res.success && [...(res.modifiedUris ?? [])].sort()).toEqual([ws.uri('model.c4'), ws.uri('views.c4')].sort())
    // recorded for the canvas undo, also with an LSP client (ADR-004)
    expect(res.success && res.historyId).toEqual(expect.any(String))
    expect(Object.keys(ws.lsp!.applied[0]!.edit.changes ?? {}).sort()).toEqual(
      [ws.uri('model.c4'), ws.uri('views.c4')].sort(),
    )
    // IT-003: the relation is visible after recompute
    const model = await ws.services.likec4.ModelBuilder.computeModel()
    expect(model.view('index' as ViewId).$view.edges).toHaveLength(1)
  })

  it('IT-004: reverts when the result has errors', async () => {
    const ws = await memfsWorkspace({
      'model.c4': modelFile,
      'views.c4': `
        views {
          view index {
            include *
          }
        }
      `,
    })
    const before = ws.read('model.c4')
    const res = await ws.apply(addRelation('cloud', 'cloud.api'))
    expect(res).toMatchObject({ success: false, code: 'invalid-result' })
    expect(res.success === false && res.error).toContain('Invalid parent-child relationship')
    expect(ws.read('model.c4')).toBe(before)
  })

  it('IT-005: reports apply-failed when the editor refuses the edit', async () => {
    const ws = await memfsWorkspace({
      'model.c4': modelFile,
      'views.c4': `
        views {
          view index {
            include *
          }
        }
      `,
    }, { lsp: true })
    ws.lsp!.result = { applied: false, failureReason: 'read-only' }
    const res = await ws.apply(addRelation('customer', 'cloud'))
    expect(res).toEqual({
      success: false,
      code: 'apply-failed',
      error: 'Failed to apply changes: read-only',
    })
  })

  it('issue 002: requests with and without projectId share the same queue', async () => {
    const ws = await memfsWorkspace({
      'model.c4': modelFile,
      'views.c4': `
        views {
          view index {
            include *
          }
        }
      `,
    })
    const [a, b] = await Promise.all([
      ws.apply(addRelation('customer', 'cloud')),
      ws.apply({ ...addRelation('customer', 'cloud.api'), projectId: 'default' }),
    ])
    expect(a).toMatchObject({ success: true })
    expect(b).toMatchObject({ success: true })
    expect(ws.read('model.c4')).toContain(
      dsl(`
      customer = actor 'Customer' {
        -> cloud
        -> cloud.api
      }
    `).replaceAll('\n', '\n  ').trimEnd(),
    )
  })

  it('IT-008: applies concurrent changes one at a time', async () => {
    const ws = await memfsWorkspace({
      'model.c4': modelFile,
      'views.c4': `
        views {
          view index {
            include *
          }
        }
      `,
    })
    const [a, b] = await Promise.all([
      ws.apply(addRelation('customer', 'cloud')),
      ws.apply(addRelation('customer', 'cloud.api')),
    ])
    expect(a).toMatchObject({ success: true })
    expect(b).toMatchObject({ success: true })
    expect(ws.read('model.c4')).toContain(
      dsl(`
      customer = actor 'Customer' {
        -> cloud
        -> cloud.api
      }
    `).replaceAll('\n', '\n  ').trimEnd(),
    )
  })
})

describe('add-relation: source from another project', () => {
  it('UT-011: writes the relation in the model of the view file, when the source is imported', async () => {
    const { services, validateAll, projects } = await createMultiProjectTestServices({
      projectA: {
        model: `
          import { cloud } from 'projectB'
          specification { element actor }
          model {
            customer = actor 'Customer'
          }
          views {
            view index {
              include *
            }
          }
        `,
      },
      projectB: {
        model: `
          specification { element system }
          model { cloud = system 'Cloud' }
        `,
      },
    })
    await validateAll()
    // in-memory file system for the written files
    const files = new Map(services.shared.workspace.LangiumDocuments.all.map(d => [
      d.uri.toString(),
      d.textDocument.getText(),
    ]))
    const fs = services.shared.workspace.FileSystemProvider
    vi.spyOn(fs, 'readFile').mockImplementation(async uri => files.get(uri.toString()) ?? '')
    vi.spyOn(fs, 'writeFile').mockImplementation(async (uri, content) => {
      files.set(uri.toString(), content)
    })

    const res = await services.likec4.ModelChanges.applyChange({
      ...addRelation('@projectB.cloud', 'customer'),
      projectId: 'projectA',
    })
    expect(res).toMatchObject({ success: true })
    expect(files.get(projects.projectA.model.uri.toString())?.trim()).toBe(
      dsl(`
      import { cloud } from 'projectB'
      specification { element actor }
      model {
        customer = actor 'Customer'
        cloud -> customer
      }
      views {
        view index {
          include *
        }
      }
    `).trimEnd(),
    )
    // visible through `include *`, no include added
    const computed = await services.likec4.ModelBuilder.computeModel('projectA' as never)
    expect(computed.view('index' as ViewId).$view.edges.map(e => [e.source, e.target])).toEqual([
      ['@projectB.cloud', 'customer'],
    ])
  })
})

describe('add-relation: kind and technology', () => {
  const files = {
    'model.c4': `
      specification {
        element system
        relationship async
      }
      model {
        api = system 'API' {
          description 'Public API'
        }
        queue = system 'Queue'
      }
      views {
        view index {
          include *
        }
      }
    `,
  }
  const withProps = (props: { title?: string; kind?: RelationshipKind; technology?: string }) => ({
    viewId: 'index' as ViewId,
    change: { op: 'add-relation' as const, source: 'api' as Fqn, target: 'queue' as Fqn, ...props },
  })

  it('UT-210: writes the kind in the connector', async () => {
    const ws = await memfsWorkspace(files)
    expect(await ws.apply(withProps({ kind: 'async' as RelationshipKind }))).toMatchObject({ success: true })
    expect(ws.read('model.c4')).toContain(`    description 'Public API'\n    -[async]-> queue\n  }`)
  })

  it('UT-211: writes the technology as a body property, after the title', async () => {
    const ws = await memfsWorkspace(files)
    expect(await ws.apply(withProps({ title: 'publishes', kind: 'async' as RelationshipKind, technology: 'Kafka' })))
      .toMatchObject({
        success: true,
      })
    expect(ws.read('model.c4')).toContain(
      `    description 'Public API'\n    -[async]-> queue 'publishes' {\n      technology 'Kafka'\n    }\n  }`,
    )
    const model = await ws.services.likec4.ModelBuilder.computeModel()
    const relation = [...model.relationships()].find(r => r.source.id === 'api')
    expect(relation).toMatchObject({ title: 'publishes', kind: 'async', technology: 'Kafka' })
  })

  it('UT-212: rejects an undeclared kind without writing', async () => {
    const ws = await memfsWorkspace(files)
    const before = ws.read('model.c4')
    expect(await ws.apply(withProps({ kind: 'sync' as RelationshipKind }))).toMatchObject({
      success: false,
      code: 'unknown-kind',
    })
    expect(ws.read('model.c4')).toBe(before)
  })
})
