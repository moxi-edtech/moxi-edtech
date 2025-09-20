import { test, expect } from '@playwright/test'

// These smoke tests document expected redirects for unauthenticated users.
// More comprehensive, authenticated tests would require seeding users and
// a Supabase test project. Enable when that environment is available.

test.describe.skip('permissions (requires seeded environment)', () => {
  test('redirects unauthenticated to /login (secretaria)', async ({ page }) => {
    await page.goto('/secretaria')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('redirects unauthenticated to /login (financeiro)', async ({ page }) => {
    await page.goto('/financeiro')
    await expect(page).toHaveURL(/\/login$/)
  })
})

