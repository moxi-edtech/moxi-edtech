import { test, expect } from '@playwright/test'

const SEED_HEADER = 'x-test-seed-key'

test.describe('RBAC permissions (e2e)', () => {
  test.skip(!process.env.TEST_SEED_KEY, 'Requires TEST_SEED_KEY and Supabase envs to run')

  let secretaria: { email: string; password: string }
  let financeiro: { email: string; password: string }

  test.beforeAll(async ({ request }) => {
    const res = await request.post('/api/test/seed', {
      headers: { [SEED_HEADER]: process.env.TEST_SEED_KEY as string },
    })
    const data = await res.json()
    if (!res.ok || !data?.ok) throw new Error('Seed failed: ' + (data?.error || res.status()))
    secretaria = data.users.secretaria
    financeiro = data.users.financeiro
  })

  test('secretaria: can access /secretaria, blocked from /financeiro', async ({ page }) => {
    await page.goto('/login')
    await page.fill('#email', secretaria.email)
    await page.fill('#senha', secretaria.password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/redirect$/)
    await page.goto('/secretaria')
    await expect(page).toHaveURL(/\/secretaria$/)
    await page.goto('/financeiro')
    await expect(page).toHaveURL('/')
  })

  test('financeiro: can access /financeiro, blocked from /secretaria', async ({ page }) => {
    await page.goto('/login')
    await page.fill('#email', financeiro.email)
    await page.fill('#senha', financeiro.password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/redirect$/)
    await page.goto('/financeiro')
    await expect(page).toHaveURL(/\/financeiro$/)
    await page.goto('/secretaria')
    await expect(page).toHaveURL('/')
  })
})

