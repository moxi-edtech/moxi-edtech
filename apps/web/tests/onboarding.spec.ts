import { test, expect } from '@playwright/test'

const ESCOLA_ID = '00000000-0000-0000-0000-000000000000'
const ONBOARDING_URL = `/escola/${ESCOLA_ID}/onboarding`

test.beforeEach(async ({ page, context }) => {
  // Mock Supabase REST for escolas basic fetch
  await page.route('**/rest/v1/escolas**', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ nome: 'Escola Teste', logo_url: null, cor_primaria: '#3b82f6' }),
    })
  })

  // Mock storage upload/remove/list endpoints
  await page.route('**/storage/v1/object/**', async (route) => {
    const url = route.request().url()
    const method = route.request().method()
    if (url.includes('/list')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
    }
    if (url.includes('/remove')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
    }
    if (method === 'POST' || method === 'PUT') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Key: 'ok' }) })
    }
    return route.continue()
  })

  // Mock onboarding draft API
  let draftPutCount = 0
  await page.route('**/api/escolas/*/onboarding/draft', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, draft: null }) })
    }
    if (method === 'PUT') {
      draftPutCount++
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    }
    if (method === 'DELETE') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    }
    return route.continue()
  })

  // Attach counter to page for assertions in tests
  ;(page as any)._draftPutCount = () => draftPutCount

  // Mock onboarding finalize API
  await page.route('**/api/escolas/*/onboarding', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, nextPath: `/escola/${ESCOLA_ID}/admin/dashboard` }),
    })
  })

  await context.addCookies([
    // Ensure app sees we are authenticated if needed; adjust cookie names if necessary
    // { name: 'sb:token', value: 'test', url: page.url() },
  ])
})

test('offline finalize auto-resume', async ({ page, context }) => {
  await page.goto(ONBOARDING_URL)

  // Step 1
  await page.getByPlaceholder('Nome da escola').fill('Minha Escola')
  await page.getByRole('button', { name: 'Próximo' }).click()

  // Step 2
  await page.getByRole('button', { name: 'Próximo' }).click()

  // Go offline and attempt finalize
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Finalizar' }).click()

  // Pending flag should be set
  const flag = await page.evaluate(() => {
    const id = '00000000-0000-0000-0000-000000000000'
    return window.localStorage.getItem(`onboarding:${id}:pendingFinalize`)
  })
  expect(flag).toBe('true')

  // Back online triggers auto finalize and navigation
  await context.setOffline(false)
  await page.waitForURL(`**/escola/${ESCOLA_ID}/admin/dashboard`, { timeout: 15_000 })
})

test('logo upload, sync and remove', async ({ page }) => {
  await page.goto(ONBOARDING_URL)

  // Upload a test SVG as logo
  const fileInput = page.locator('input#logo-upload')
  await fileInput.setInputFiles('tests/fixtures/logo.svg')

  // Expect preview image to exist with http src (public URL)
  const img = page.locator('img[alt="Preview"]')
  await expect(img).toBeVisible()
  const src = await img.getAttribute('src')
  expect(src).toBeTruthy()

  // Ensure an immediate draft PUT was issued
  const countAfterUpload = await (page as any)._draftPutCount()
  expect(countAfterUpload).toBeGreaterThan(0)

  // Remove logo (accept confirm)
  page.once('dialog', async (d) => d.accept())
  await page.getByRole('button', { name: 'Remover logo' }).click()

  // Placeholder should reappear (no preview image)
  await expect(page.locator('img[alt="Preview"]')).toHaveCount(0)

  // Ensure another draft PUT occurred
  const countAfterRemove = await (page as any)._draftPutCount()
  expect(countAfterRemove).toBeGreaterThan(countAfterUpload)
})

