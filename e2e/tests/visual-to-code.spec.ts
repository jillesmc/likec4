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

  // Drag from the "connect" button (visible on hover) and release anywhere over the target node
  await customer.hover()
  const handle = customer.locator('.likec4-connect-handle')
  await expect(handle).toBeVisible()
  const from = (await handle.boundingBox())!
  const to = (await cloud.boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  // near the top-left corner, away from the node center
  await page.mouse.move(to.x + 20, to.y + 20, { steps: 10 })
  await page.mouse.up()
  // the relation details are asked first, Enter keeps them empty
  await page.getByLabel('Relation title').press('Enter')

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
  // US-017: the palette tells that new elements stay where they are dropped
  await expect(page.locator('[data-likec4-palette-notice]')).toContainText('This view has a manual layout')

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
  // US-017: and the first drop shows it as a toast
  await expect(page.locator('[data-likec4-manual-layout-notice]')).toBeVisible()

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

test('E2E-006: the identifier follows the title and can be replaced by typing', async ({ page }) => {
  await page.goto('/view/index/')
  await expect(page.locator('.react-flow__node[data-id="customer"]')).toBeVisible()
  await page.locator('button:has(svg.tabler-icon-lock)').click()

  const pane = page.locator('.react-flow__pane')
  const paneBox = (await pane.boundingBox())!
  await page.locator('[data-likec4-palette-kind="system"]').dragTo(pane, {
    targetPosition: { x: 200, y: paneBox.height - 150 },
  })

  const title = page.getByLabel('Title of the new system')
  const identifier = page.getByLabel('Identifier')
  await expect(identifier).toHaveValue('newSystem')
  await title.fill('Payment Service')
  await expect(identifier).toHaveValue('paymentService')

  // Tab selects the suggestion, typing replaces it
  await title.press('Tab')
  await page.keyboard.type('payments')
  await expect(identifier).toHaveValue('payments')
  // the title no longer changes the typed identifier
  await title.fill('Payment Services')
  await expect(identifier).toHaveValue('payments')

  // a taken identifier is refused
  await identifier.fill('cloud')
  await expect(page.getByText('Already used by a sibling')).toBeVisible()
  await identifier.press('Enter')
  await expect(identifier).toBeVisible()

  await identifier.fill('payments')
  await identifier.press('Enter')
  await expect.poll(() => readServed(), { timeout: 10_000 }).toContain(`  payments = system 'Payment Services'`)
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

test('E2E-003: Del excludes the selected element from the view', async ({ page }) => {
  await page.goto('/view/index/')
  const cloud = page.locator('.react-flow__node[data-id="cloud"]')
  await expect(cloud).toBeVisible()
  await page.locator('button:has(svg.tabler-icon-lock)').click()

  await cloud.click()
  await page.keyboard.press('Delete')

  await expect.poll(() => readServed(), { timeout: 10_000 }).toContain(`    include *\n    exclude cloud\n`)
  await expect(cloud).toHaveCount(0, { timeout: 10_000 })
  // The model is not changed
  expect(await readServed()).toContain(`  cloud = system 'Cloud System'`)
})

test('US-005: deleting an unreferenced element from the model removes its definition', async ({ page }) => {
  await page.goto('/view/index/')
  const cloud = page.locator('.react-flow__node[data-id="cloud"]')
  await expect(cloud).toBeVisible()
  await page.locator('button:has(svg.tabler-icon-lock)').click()

  await cloud.click()
  await page.getByRole('button', { name: 'Delete from model' }).click()
  const dialog = page.getByRole('dialog', { name: 'Delete "Cloud System" from model?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Delete' }).click()

  await expect.poll(() => readServed(), { timeout: 10_000 }).not.toContain(`cloud = system`)
  await expect(cloud).toHaveCount(0, { timeout: 10_000 })
})

test('US-004 AC-4: excluding in a view with manual layout updates the snapshot without drift', async ({ page }) => {
  await page.goto('/view/index/')
  const customer = page.locator('.react-flow__node[data-id="customer"]')
  const cloud = page.locator('.react-flow__node[data-id="cloud"]')
  await expect(customer).toBeVisible()
  await page.locator('button:has(svg.tabler-icon-lock)').click()

  // Move a node to save a manual layout snapshot
  const box = (await customer.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 - 150, box.y + box.height / 2, { steps: 10 })
  await page.mouse.up()
  await expect.poll(() => hasManualLayout('index'), { timeout: 10_000 }).toBe(true)

  await cloud.click()
  await page.keyboard.press('Delete')

  await expect.poll(() => readServed(), { timeout: 10_000 }).toContain(`exclude cloud`)
  await expect(cloud).toHaveCount(0, { timeout: 10_000 })
  await expect.poll(() => readServed('.likec4/index.likec4.snap'), { timeout: 10_000 }).not.toContain(`id: 'cloud'`)
  await expect(page.locator('button:has(svg.tabler-icon-alert-triangle)')).toHaveCount(0)
})

test('US-001 EC-11: connecting in a view with manual layout updates the snapshot without drift', async ({ page }) => {
  await page.goto('/view/index/')
  const customer = page.locator('.react-flow__node[data-id="customer"]')
  const cloud = page.locator('.react-flow__node[data-id="cloud"]')
  await expect(customer).toBeVisible()
  await page.locator('button:has(svg.tabler-icon-lock)').click()

  // Move a node to save a manual layout snapshot
  const box = (await customer.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 - 150, box.y + box.height / 2, { steps: 10 })
  await page.mouse.up()
  await expect.poll(() => hasManualLayout('index'), { timeout: 10_000 }).toBe(true)
  await expect.poll(() => readServed('.likec4/index.likec4.snap')).toContain('edges: []')

  await customer.hover()
  const from = (await customer.locator('.likec4-connect-handle').boundingBox())!
  const to = (await cloud.boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + 20, to.y + 20, { steps: 10 })
  await page.mouse.up()
  // the relation details are asked first, Enter keeps them empty
  await page.getByLabel('Relation title').press('Enter')

  await expect.poll(() => readServed(), { timeout: 10_000 }).toContain(`-> cloud`)
  await expect.poll(() => readServed('.likec4/index.likec4.snap'), { timeout: 10_000 }).not.toContain('edges: []')
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  await expect(page.locator('button:has(svg.tabler-icon-alert-triangle)')).toHaveCount(0)
})

test('E2E-007: connecting asks for title, kind and technology', async ({ page }) => {
  await page.goto('/view/index/')
  const customer = page.locator('.react-flow__node[data-id="customer"]')
  const cloud = page.locator('.react-flow__node[data-id="cloud"]')
  await expect(customer).toBeVisible()
  await page.locator('button:has(svg.tabler-icon-lock)').click()

  await customer.hover()
  const from = (await customer.locator('.likec4-connect-handle').boundingBox())!
  const to = (await cloud.boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + 20, to.y + 20, { steps: 10 })
  await page.mouse.up()

  await page.getByLabel('Relation title').fill('uses')
  await page.getByLabel('Relation kind').selectOption('async')
  await page.getByLabel('Relation technology').fill('HTTPS')
  await page.getByLabel('Relation technology').press('Enter')

  await expect.poll(() => readServed(), { timeout: 10_000 }).toContain(
    [
      `    -[async]-> cloud 'uses' {`,
      `      technology 'HTTPS'`,
      `    }`,
    ].join('\n'),
  )
  await expect(page.locator('.react-flow__edge')).toHaveCount(1, { timeout: 10_000 })
})

test('US-014: double-clicking a relation label edits its title', async ({ page }) => {
  await page.goto('/view/index/')
  const customer = page.locator('.react-flow__node[data-id="customer"]')
  const cloud = page.locator('.react-flow__node[data-id="cloud"]')
  await expect(customer).toBeVisible()
  await page.locator('button:has(svg.tabler-icon-lock)').click()

  await customer.hover()
  const from = (await customer.locator('.likec4-connect-handle').boundingBox())!
  const to = (await cloud.boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + 20, to.y + 20, { steps: 10 })
  await page.mouse.up()
  await page.getByLabel('Relation title').fill('uses')
  await page.getByLabel('Relation title').press('Enter')
  await expect.poll(() => readServed(), { timeout: 10_000 }).toContain(`-> cloud 'uses'`)

  const label = page.locator('.likec4-edge-label-container').getByText('uses', { exact: true })
  await expect(label).toBeVisible({ timeout: 10_000 })
  await label.dblclick()
  const input = page.getByLabel('Title')
  await expect(input).toHaveValue('uses')
  await input.fill('uses daily')
  await input.press('Enter')
  await expect.poll(() => readServed(), { timeout: 10_000 }).toContain(`-> cloud 'uses daily'`)
  // ends once the view is updated, so the next test's fixture restore is not mixed with this write
  await expect(page.locator('.likec4-edge-label-container').getByText('uses daily', { exact: true }))
    .toBeVisible({ timeout: 10_000 })
})

test('E2E-004: Ctrl+Z / Ctrl+Shift+Z undo and redo model changes', async ({ page }) => {
  const fixture = await readServed()
  await page.goto('/view/index/')
  const customer = page.locator('.react-flow__node[data-id="customer"]')
  const cloud = page.locator('.react-flow__node[data-id="cloud"]')
  await expect(customer).toBeVisible()
  // the server has reloaded the restored fixture (relations of previous tests are gone)
  await expect(page.locator('.react-flow__edge')).toHaveCount(0, { timeout: 10_000 })
  await page.locator('button:has(svg.tabler-icon-lock)').click()

  await customer.hover()
  const handle = customer.locator('.react-flow__handle.source')
  const from = (await handle.boundingBox())!
  const to = (await cloud.boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 })
  await page.mouse.up()
  // the relation details are asked first, Enter keeps them empty
  await page.getByLabel('Relation title').press('Enter')
  await expect(page.locator('.react-flow__edge')).toHaveCount(1, { timeout: 10_000 })
  const changed = await readServed()
  expect(changed).toContain('-> cloud')

  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(() => readServed(), { timeout: 10_000 }).toBe(fixture)
  await expect(page.locator('.react-flow__edge')).toHaveCount(0, { timeout: 10_000 })

  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect.poll(() => readServed(), { timeout: 10_000 }).toBe(changed)
  await expect(page.locator('.react-flow__edge')).toHaveCount(1, { timeout: 10_000 })
})

test('US-007 + US-008: deployment view palette creates nodes and instances', async ({ page }) => {
  await page.goto('/view/prod/')
  const prod = page.locator('.react-flow__node[data-id="prod"]')
  await expect(prod).toBeVisible()
  await page.locator('button:has(svg.tabler-icon-lock)').click()

  // Deployment node kind dropped on "prod"
  await page.locator('[data-likec4-palette-kind="vm"]').dragTo(prod)
  const title = page.getByLabel('Title of the new vm')
  await title.fill('Worker')
  await title.press('Enter')
  await expect.poll(() => readServed('deployment.c4'), { timeout: 10_000 }).toContain(
    `  prod = env 'Production' {\n    worker = vm 'Worker'\n  }`,
  )

  // "Instance" dropped on the new node
  const worker = page.locator('.react-flow__node[data-id="prod.worker"]')
  await expect(worker).toBeVisible({ timeout: 10_000 })
  await page.locator('[data-likec4-palette-kind="@instance"]').dragTo(worker)
  const element = page.getByLabel('Element to deploy')
  await element.fill('customer')
  await element.press('Enter')
  await expect.poll(() => readServed('deployment.c4'), { timeout: 10_000 }).toContain(
    `    worker = vm 'Worker' {\n      instanceOf customer\n    }`,
  )
  await expect(page.locator('.react-flow__node[data-id="prod.worker.customer"]')).toBeVisible({ timeout: 10_000 })
})

test('US-009: connecting two elements in a dynamic view appends a step', async ({ page }) => {
  await page.goto('/view/flow/?dynamic=diagram')
  const app = page.locator('.react-flow__node[data-id="customer.app"]')
  const web = page.locator('.react-flow__node[data-id="customer.web"]')
  await expect(app).toBeVisible()
  await page.locator('button:has(svg.tabler-icon-lock)').click()

  await app.hover()
  const handle = app.locator('.react-flow__handle.source')
  await expect(handle).toBeVisible()
  const from = (await handle.boundingBox())!
  const to = (await web.boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 })
  await page.mouse.up()
  // title and position are asked first, Enter appends without title
  await page.getByLabel('Step title').press('Enter')

  await expect.poll(() => readServed('dynamic.c4'), { timeout: 10_000 }).toContain(
    `  dynamic view flow {\n    customer.app -> customer.web\n    include customer.app, customer.web\n  }`,
  )
  await expect(page.locator('.react-flow__edge')).toHaveCount(1, { timeout: 10_000 })
  // No model relation is created
  expect(await readServed()).not.toContain('-> customer.web')
})

test('US-015 + E2E-008: a step inserted at a chosen position, a step removed with Del', async ({ page }) => {
  await page.goto('/view/flow/?dynamic=diagram')
  const app = page.locator('.react-flow__node[data-id="customer.app"]')
  const web = page.locator('.react-flow__node[data-id="customer.web"]')
  await expect(app).toBeVisible()
  await expect(page.locator('.react-flow__edge')).toHaveCount(0, { timeout: 10_000 })
  await page.locator('button:has(svg.tabler-icon-lock)').click()

  // waits until the node stops moving (the view is laid out again after each step)
  const settled = async (node: typeof app) => {
    await expect.poll(async () => {
      const a = await node.boundingBox()
      await page.waitForTimeout(150)
      const b = await node.boundingBox()
      return JSON.stringify(a) === JSON.stringify(b)
    }, { timeout: 10_000 }).toBe(true)
  }
  const connect = async (from: typeof app, to: typeof app) => {
    await settled(from)
    await settled(to)
    await from.hover()
    const handle = (await from.locator('.likec4-connect-handle').boundingBox())!
    const box = (await to.boundingBox())!
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + 20, box.y + 20, { steps: 10 })
    await page.mouse.up()
  }

  await connect(app, web)
  await page.getByLabel('Step title').press('Enter')
  await expect(page.locator('.react-flow__edge')).toHaveCount(1, { timeout: 10_000 })

  // US-015: before the first step
  await connect(web, app)
  await page.getByLabel('Step title').fill('back')
  await page.getByLabel('Step position').selectOption({ label: 'Before step 1: App → Web' })
  await page.getByLabel('Step title').press('Enter')
  await expect.poll(() => readServed('dynamic.c4'), { timeout: 10_000 }).toContain(
    `    customer.web -> customer.app 'back'\n    customer.app -> customer.web\n`,
  )
  await expect(page.locator('.react-flow__edge')).toHaveCount(2, { timeout: 10_000 })

  // E2E-008: Del on the step `App -> Web` (now step 2) removes it
  await settled(app)
  await settled(web)
  // click a point on the curve (the center of its bounding box may be off the stroke)
  const onCurve = await page.getByRole('group', { name: 'Relationship from App to Web.', exact: true })
    .locator('path').first().evaluate((path: SVGPathElement) => {
      const point = path.getPointAtLength(path.getTotalLength() / 2)
      const { x, y } = point.matrixTransform(path.getScreenCTM()!)
      return { x, y }
    })
  await page.mouse.click(onCurve.x, onCurve.y)
  await expect(page.locator('.react-flow__edge.selected')).toHaveCount(1)
  await page.keyboard.press('Delete')
  await expect.poll(() => readServed('dynamic.c4'), { timeout: 10_000 }).not.toContain(
    `customer.app -> customer.web`,
  )
  await expect(page.locator('.react-flow__edge')).toHaveCount(1, { timeout: 10_000 })
})

test('E2E-009 (review 005): undo of an element dropped in a manual layout view leaves no drift', async ({ page }) => {
  await page.goto('/view/index/')
  const customer = page.locator('.react-flow__node[data-id="customer"]')
  await expect(customer).toBeVisible()
  await page.locator('button:has(svg.tabler-icon-lock)').click()

  const box = (await customer.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 - 150, box.y + box.height / 2, { steps: 10 })
  await page.mouse.up()
  await expect.poll(() => hasManualLayout('index'), { timeout: 10_000 }).toBe(true)

  const pane = page.locator('.react-flow__pane')
  const paneBox = (await pane.boundingBox())!
  await page.locator('[data-likec4-palette-kind="system"]').dragTo(pane, {
    targetPosition: { x: 200, y: paneBox.height - 150 },
  })
  const input = page.getByLabel('Title of the new system')
  await input.fill('Billing')
  await input.press('Enter')
  await expect.poll(() => readServed('.likec4/index.likec4.snap'), { timeout: 10_000 }).toContain(`id: 'billing'`)

  await page.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(() => readServed(), { timeout: 10_000 }).not.toContain(`billing = system`)
  await expect.poll(() => readServed('.likec4/index.likec4.snap'), { timeout: 10_000 }).not.toContain(`id: 'billing'`)
  await expect(page.locator('button:has(svg.tabler-icon-alert-triangle)')).toHaveCount(0)

  // the snapshot refresh after the undo keeps the redo history
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect.poll(() => readServed(), { timeout: 10_000 }).toContain(`billing = system 'Billing'`)
  await expect.poll(() => readServed('.likec4/index.likec4.snap'), { timeout: 10_000 }).toContain(`id: 'billing'`)
  await expect(page.locator('.react-flow__node[data-id="billing"]')).toBeVisible({ timeout: 10_000 })
})

test('review 008: a relation without label can be deleted from the model', async ({ page }) => {
  await page.goto('/view/index/')
  const customer = page.locator('.react-flow__node[data-id="customer"]')
  const cloud = page.locator('.react-flow__node[data-id="cloud"]')
  await expect(customer).toBeVisible()
  await page.locator('button:has(svg.tabler-icon-lock)').click()

  await customer.hover()
  const handle = customer.locator('.react-flow__handle.source')
  const from = (await handle.boundingBox())!
  const to = (await cloud.boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 })
  await page.mouse.up()
  // the relation details are asked first, Enter keeps them empty
  await page.getByLabel('Relation title').press('Enter')
  const edge = page.locator('.react-flow__edge')
  await expect(edge).toHaveCount(1, { timeout: 10_000 })

  await edge.locator('path').first().click({ force: true })
  await page.getByRole('button', { name: 'Delete from model' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect.poll(() => readServed(), { timeout: 10_000 }).not.toContain('-> cloud')
  await expect(edge).toHaveCount(0, { timeout: 10_000 })
})

test('review 009: dropping "Instance" outside a deployment node shows a message', async ({ page }) => {
  await page.goto('/view/prod/')
  await expect(page.locator('.react-flow__node[data-id="prod"]')).toBeVisible()
  await page.locator('button:has(svg.tabler-icon-lock)').click()

  const pane = page.locator('.react-flow__pane')
  const paneBox = (await pane.boundingBox())!
  // empty canvas, away from panels (top-left) and the palette (right)
  await page.locator('[data-likec4-palette-kind="@instance"]').dragTo(pane, {
    targetPosition: { x: paneBox.width / 2, y: 40 },
  })
  await expect(page.getByRole('alert')).toContainText('Drop "Instance" on a deployment node')
})
