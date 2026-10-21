import { TextDocument, UriUtils } from 'langium'
import { vol } from 'memfs'
import stripIndent from 'strip-indent'
import { vi } from 'vitest'
import type { ApplyWorkspaceEditParams, ApplyWorkspaceEditResult } from 'vscode-languageserver'
import { URI } from 'vscode-uri'
import { WithFileSystem, WithLikeC4ManualLayouts } from '../../filesystem'
import type { ChangeView } from '../../protocol'
import { createTestServices } from '../../test'

let seq = 0

export interface FakeLspConnection {
  /**
   * Recorded `workspace/applyEdit` requests
   */
  applied: ApplyWorkspaceEditParams[]
  /**
   * Result returned to the next `workspace/applyEdit` requests
   */
  result: ApplyWorkspaceEditResult
}

/**
 * Creates a workspace backed by memfs with the given files (`name -> content`).
 * Requires `vi.mock('node:fs')` and `vi.mock('node:fs/promises')` in the spec file.
 *
 * With `lsp: true`, edits go through a fake LSP connection, that applies them to memfs.
 * With `manualLayouts: true`, manual-layout snapshots are read from and written to memfs (`.likec4/`).
 */
export async function memfsWorkspace(
  files: Record<string, string>,
  opts?: { lsp?: boolean; manualLayouts?: boolean },
) {
  const workspacePath = URI.file(`/test/workspace/model-change/ws${++seq}`)
  vol.mkdirSync(workspacePath.fsPath, { recursive: true })

  const uris = new Map<string, URI>()
  for (const [name, content] of Object.entries(files)) {
    const uri = UriUtils.joinPath(workspacePath, name)
    uris.set(name, uri)
    vol.writeFileSync(uri.fsPath, stripIndent(content).trim() + '\n', { encoding: 'utf-8' })
  }

  const { initialize, services } = createTestServices({
    workspace: workspacePath.toString(),
    context: {
      ...WithFileSystem(),
      ...opts?.manualLayouts && WithLikeC4ManualLayouts,
    },
  })

  const workspace = services.shared.workspace
  const fs = workspace.FileSystemProvider
  vi.spyOn(fs, 'readDirectory').mockResolvedValue(
    [...uris.values()].map(uri => ({ isDirectory: false, isFile: true, uri })),
  )
  vi.spyOn(fs, 'readFile').mockImplementation(async uri => vol.readFileSync(uri.fsPath, 'utf-8').toString())
  vi.spyOn(fs, 'writeFile').mockImplementation(async (uri, content) => {
    vol.mkdirSync(UriUtils.dirname(uri).fsPath, { recursive: true })
    vol.writeFileSync(uri.fsPath, content, { encoding: 'utf-8' })
  })
  vi.spyOn(fs, 'scanDirectory').mockImplementation(async (uri, filter) => {
    if (!vol.existsSync(uri.fsPath)) {
      return []
    }
    return vol.readdirSync(uri.fsPath).map(String)
      .map(name => UriUtils.joinPath(uri, name))
      .filter(file => vol.statSync(file.fsPath).isFile() && filter(file.fsPath, false))
      .map(file => ({ isDirectory: false, isFile: true, uri: file }))
  })
  vi.spyOn(fs, 'deleteFile').mockImplementation(async uri => {
    if (!vol.existsSync(uri.fsPath)) {
      return false
    }
    vol.unlinkSync(uri.fsPath)
    return true
  })

  let lsp: FakeLspConnection | null = null
  if (opts?.lsp) {
    const fake: FakeLspConnection = { applied: [], result: { applied: true } }
    lsp = fake
    const connection = {
      workspace: {
        applyEdit: async (params: ApplyWorkspaceEditParams) => {
          fake.applied.push(params)
          if (fake.result.applied) {
            // Emulate the client: apply edits to the files
            for (const [uri, edits] of Object.entries(params.edit.changes ?? {})) {
              const doc = workspace.LangiumDocuments.getDocument(URI.parse(uri))!
              vol.writeFileSync(URI.parse(uri).fsPath, TextDocument.applyEdits(doc.textDocument, edits))
            }
          }
          return fake.result
        },
      },
      window: {
        showErrorMessage: vi.fn<(message: string) => void>(),
      },
    }
    // Partial fake of the LSP connection, only methods used by ModelChanges
    vi.spyOn(services.shared.lsp, 'Connection', 'get').mockReturnValue(connection as never)
  }

  await initialize()

  function read(name: string): string {
    const uri = uris.get(name)!
    const memoryContent = workspace.LangiumDocuments.getDocument(uri)?.textDocument.getText()
    const fsContent = vol.readFileSync(uri.fsPath, 'utf-8').toString()
    if (memoryContent !== fsContent) {
      throw new Error(`Memory and FS content of ${name} differ`)
    }
    return fsContent
  }

  function apply(params: ChangeView.Params): Promise<ChangeView.Res> {
    return services.likec4.ModelChanges.applyChange(params)
  }

  /**
   * Manual-layout snapshot of the view, if any
   */
  function snapshot(viewId: string): string | null {
    const path = UriUtils.joinPath(workspacePath, '.likec4', `${viewId}.likec4.snap`).fsPath
    return vol.existsSync(path) ? vol.readFileSync(path, 'utf-8').toString() : null
  }

  return { services, read, apply, lsp, snapshot, uri: (name: string) => uris.get(name)!.toString() }
}
