import { expect, test } from '@playwright/test'
import { hasManualLayout, readServed, restoreFixture } from '../helpers/visual-to-code'

test.beforeEach(async () => {
  await restoreFixture()
})

test('E2E-001: connecting two elements writes a relation to the sources', async ({ page }) => {
  await page.goto('/view/index/')

  const customer = page.locator('.react-flow__node[data-id="customer"]')
  const cloud = page.locator('.react-flow__node[data-id="cloud"]')
  await expect(customer).toBeVisible()
  await expect(cloud).toBeVisible()
  await expect(page.locator('.react-flow__edge')).toHaveCount(0)

  // The editor starts read-only, unlock it
  await page.locator('button:has(svg.tabler-icon-lock)').click()

  // Drag from the source handle (visible on hover) and release over the target node
  await customer.hover()
  const handle = customer.locator('.react-flow__handle.source')
  await expect(handle).toBeVisible()
  const from = (await handle.boundingBox())!
  const to = (await cloud.boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 })
  await page.mouse.up()

  // Ghost is shown until the view is updated, then the real edge
  await expect(page.locator('.react-flow__edge')).toHaveCount(1, { timeout: 10_000 })
  await expect(page.locator('[data-likec4-ghost-edge]')).toHaveCount(0)

  await expect.poll(() => readServed()).toContain(
    [
      `  customer = actor 'Customer' {`,
      `    description 'A customer of Cloud System'`,
      `    -> cloud`,
      `  }`,
    ].join('\n'),
  )
})

test('E2E-002: dropping an element kind in a view with manual layout keeps it at the drop position', async ({ page }) => {
  await page.goto('/view/index/')
  const customer = page.locator('.react-flow__node[data-id="customer"]')
  await expect(customer).toBeVisible()
  await page.locator('button:has(svg.tabler-icon-lock)').click()

  // Move a node to save a manual layout snapshot
  const box = (await customer.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 - 150, box.y + box.height / 2, { steps: 10 })
  await page.mouse.up()
  await expect.poll(() => hasManualLayout('index'), { timeout: 10_000 }).toBe(true)

  // Drop "system" from the palette on empty canvas
  const pane = page.locator('.react-flow__pane')
  const paneBox = (await pane.boundingBox())!
  const drop = { x: 200, y: paneBox.height - 150 }
  await page.locator('[data-likec4-palette-kind="system"]').dragTo(pane, { targetPosition: drop })

  const input = page.getByLabel('Title of the new system')
  await expect(input).toBeVisible()
  await input.fill('Billing')
  await input.press('Enter')

  await expect.poll(() => readServed(), { timeout: 10_000 }).toContain(`  billing = system 'Billing'`)

  const billing = page.locator('.react-flow__node[data-id="billing"]')
  await expect(billing).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('[data-likec4-ghost-element]')).toHaveCount(0)
  // Placed where it was dropped (center), and the layout has no drift
  await expect.poll(async () => {
    const b = (await billing.boundingBox())!
    return Math.hypot(b.x + b.width / 2 - (paneBox.x + drop.x), b.y + b.height / 2 - (paneBox.y + drop.y))
  }, { timeout: 10_000 }).toBeLessThan(20)
  await expect(page.locator('button:has(svg.tabler-icon-alert-triangle)')).toHaveCount(0)
  // The manual layout snapshot is updated with the new element
  await expect.poll(() => readServed('.likec4/index.likec4.snap'), { timeout: 10_000 }).toContain(`id: 'billing'`)
})

test('US-003: double-clicking a node edits its title in the sources', async ({ page }) => {
  await page.goto('/view/index/')
  const cloud = page.locator('.react-flow__node[data-id="cloud"]')
  await expect(cloud).toBeVisible()
  await page.locator('button:has(svg.tabler-icon-lock)').click()

  await cloud.dblclick()
  const input = page.getByLabel('Title', { exact: true })
  await expect(input).toHaveValue('Cloud System')
  await input.fill('Cloud Platform')
  await input.press('Enter')

  await expect.poll(() => readServed(), { timeout: 10_000 }).toContain(`  cloud = system 'Cloud Platform'`)
  await expect(cloud).toContainText('Cloud Platform', { timeout: 10_000 })
})
