import k from 'tinyrainbow'
import type { LikeC4VitePluginRpc } from '../protocol'
import type { PluginRPCParams } from '../rpc'

export async function updateView({
  logger,
  likec4,
}: PluginRPCParams, data: Parameters<LikeC4VitePluginRpc['updateView']>[0]) {
  logger.info([
    k.green('view:onChange'),
    k.dim('project'),
    data.projectId,
    k.dim('view'),
    data.viewId,
    k.dim('change'),
    data.change.op,
  ].join(' '))
  const result = await likec4.editor.applyChange(data)
  if (!result.success) {
    const message = result.code ? `[${result.code}] ${result.error}` : result.error
    logger.error(`Failed to apply view change:\n${message}`)
    const err = new Error(message)
    err.stack = message
    throw err
  }
  logger.info([
    k.green('view:onChange'),
    '✅',
  ].join(' '))
  return {
    ...result.historyId && { historyId: result.historyId },
    ...result.created && { created: result.created },
  }
}
