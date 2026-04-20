import { test, expect } from '@playwright/test'

test.describe('Escola access regression', () => {
  test.skip(
    !process.env.TEST_LOGIN_EMAIL || !process.env.TEST_LOGIN_PASSWORD || !process.env.TEST_ESCOLA_SLUG,
    'Requires TEST_LOGIN_EMAIL, TEST_LOGIN_PASSWORD, TEST_ESCOLA_SLUG'
  )

  test('redirect + modelos-avaliacao + onboarding-draft should not return 403', async ({ page }) => {
    const email = process.env.TEST_LOGIN_EMAIL as string
    const password = process.env.TEST_LOGIN_PASSWORD as string
    const escolaSlug = process.env.TEST_ESCOLA_SLUG as string

    await page.goto('/login')
    await page.fill('#email', email)
    await page.fill('#senha', password)
    await page.click('button[type="submit"]')

    await page.waitForURL(/\/redirect|\/escola\/.+/, { timeout: 30_000 })
    await page.goto('/redirect')
    await page.waitForLoadState('networkidle')

    const modelosStatus = await page.evaluate(async (slug) => {
      const res = await fetch(`/api/escolas/${slug}/modelos-avaliacao?limit=50`, {
        method: 'GET',
        credentials: 'include',
      })
      return res.status
    }, escolaSlug)

    const draftStatus = await page.evaluate(async (slug) => {
      const res = await fetch(`/api/escolas/${slug}/onboarding/draft`, {
        method: 'GET',
        credentials: 'include',
      })
      return res.status
    }, escolaSlug)

    expect(modelosStatus, 'modelos-avaliacao should return 200').toBe(200)
    expect(draftStatus, 'onboarding/draft should return 200').toBe(200)
  })
})

