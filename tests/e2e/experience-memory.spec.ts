import { test, expect } from '@playwright/test'

test.describe('Experience Memory', () => {
  test('experience page redirige a login sin sesión', async ({ page }) => {
    await page.goto('/dashboard/assistants/fake-id/experience')
    await page.waitForURL(/.*login.*/, { timeout: 10_000 })
    expect(page.url()).toContain('login')
  })

  test('experience suggestions API retorna 401 sin sesión', async ({ request }) => {
    const res = await request.get('/api/admin/experience/suggestions')
    expect(res.status()).toBe(401)
  })

  test('experience patterns API retorna 401 sin sesión', async ({ request }) => {
    const res = await request.get('/api/admin/experience/patterns')
    expect(res.status()).toBe(401)
  })
})
