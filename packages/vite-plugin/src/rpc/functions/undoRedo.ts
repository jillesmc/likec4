import k from 'tinyrainbow'
import type { LikeC4VitePluginRpc } from '../protocol'
import type { PluginRPCParams } from '../rpc'

async function restore(
  { logger, likec4 }: PluginRPCParams,
  direction: 'undo' | 'redo',
  data: Parameters<LikeC4VitePluginRpc['undoChange']>[0],
) {
  logger.info([k.green(`view:${direction}`), k.dim('project'), data.projectId].join(' '))
  const result = direction === 'undo' ? await likec4.editor.undo(data) : await likec4.editor.redo(data)
  if (!result.success) {
    const message = result.code ? `[${result.code}] ${result.error}` : result.error
    logger.error(`Failed to ${direction} change:\n${message}`)
    const err = new Error(message)
    err.stack = message
    throw err
  }
}

export function undoChange(params: PluginRPCParams, data: Parameters<LikeC4VitePluginRpc['undoChange']>[0]) {
  return restore(params, 'undo', data)
}

export function redoChange(params: PluginRPCParams, data: Parameters<LikeC4VitePluginRpc['redoChange']>[0]) {
  return restore(params, 'redo', data)
}
