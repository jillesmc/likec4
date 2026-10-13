// Editing on the canvas (visual-to-code) against `likec4 start`.
// The dev server serves a copy of `fixtures/visual-to-code`, tests restore it before each run.

import { defineConfig, devices } from '@playwright/test'
import { isCI } from 'std-env'
import { VISUAL_TO_CODE_DIR } from './helpers/visual-to-code'

export default defineConfig({
  testDir: 'tests',
  testMatch: ['**/visual-to-code.spec.ts'],
  forbidOnly: isCI,
  timeout: 30 * 1000,
  retries: isCI ? 1 : 0,
  // Tests change the same files
  workers: 1,
  reporter: isCI ? [['github'], ['list'], ['html']] : 'list',

  use: {
    baseURL: 'http://127.0.0.1:5176',
    browserName: 'chromium',
    colorScheme: 'light',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command:
      `rm -rf "${VISUAL_TO_CODE_DIR}" && cp -r ./fixtures/visual-to-code "${VISUAL_TO_CODE_DIR}" && pnpm likec4 start "${VISUAL_TO_CODE_DIR}" --listen 127.0.0.1 --port 5176`,
    url: 'http://127.0.0.1:5176',
    stdout: 'pipe',
    timeout: 120 * 1000,
    env: {
      BROWSER: 'none',
    },
  },
})
