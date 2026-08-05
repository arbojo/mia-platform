import { test, expect } from '@playwright/test'

test.describe('Public pages', () => {
  test('landing page loads', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
  })

  test('login page loads', async ({ page }) => {
    const response = await page.goto('/login')
    expect(response?.status()).toBe(200)
    await expect(page.locator('h1, h2, [class*="heading"]')).toBeVisible()
  })

  test('signup page loads', async ({ page }) => {
    const response = await page.goto('/signup')
    expect(response?.status()).toBe(200)
    await expect(page.locator('h1, h2, [class*="heading"]')).toBeVisible()
  })
})

test.describe('Dashboard (unauthenticated)', () => {
  test('redirects to login', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL(/.*login.*/, { timeout: 10_000 })
    expect(page.url()).toContain('login')
  })
})
