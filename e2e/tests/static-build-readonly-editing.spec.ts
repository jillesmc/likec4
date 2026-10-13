import { expect, test } from '@playwright/test'
import { canvas } from '../helpers/selectors'
import { TIMEOUT_CANVAS } from '../helpers/timeouts'

test('E2E-005: static build has no canvas editing affordances', async ({ page }) => {
  await page.goto('/project/e2e/view/index/')
  await expect(canvas(page)).toBeVisible({ timeout: TIMEOUT_CANVAS })

  const nodes = page.locator('.react-flow__node')
  const count = await nodes.count()
  expect(count).toBeGreaterThan(0)

  await expect(page.locator('svg.tabler-icon-lock')).toHaveCount(0)
  await expect(page.locator('[data-likec4-palette]')).toHaveCount(0)
  await expect(page.locator('.react-flow__handle.connectablestart')).toHaveCount(0)

  // Delete has no effect
  await page.locator('.react-flow__node-element').first().click()
  await page.keyboard.press('Delete')
  await page.keyboard.press('Backspace')
  await expect(nodes).toHaveCount(count)
})
