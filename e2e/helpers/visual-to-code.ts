import { copyFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Directory served by the dev server in `playwright.dev-server.config.ts`
 */
export const VISUAL_TO_CODE_DIR = join(tmpdir(), 'likec4-e2e-visual-to-code')

const FIXTURE_DIR = new URL('../fixtures/visual-to-code/', import.meta.url)

/**
 * Restores the served copy of the fixture file
 */
export async function restoreFixture(file = 'model.c4'): Promise<void> {
  await copyFile(new URL(file, FIXTURE_DIR), join(VISUAL_TO_CODE_DIR, file))
}

/**
 * Reads the served copy of the fixture file
 */
export async function readServed(file = 'model.c4'): Promise<string> {
  return await readFile(join(VISUAL_TO_CODE_DIR, file), 'utf-8')
}
