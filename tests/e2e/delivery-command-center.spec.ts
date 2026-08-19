import { test, expect } from '@playwright/test'

test.describe('Command Center — Delivery Hub', () => {
  test('redirige a login desde /dashboard/delivery (no autenticado)', async ({ page }) => {
    await page.goto('/dashboard/delivery')
    await page.waitForURL(/.*login.*/, { timeout: 10_000 })
    expect(page.url()).toContain('login')
  })

  test('la API command-center requiere autenticación', async ({ request }) => {
    const response = await request.get('/api/admin/delivery/command-center?business_id=00000000-0000-4000-8000-000000000000')
    expect(response.ok()).toBe(false)
  })

  test('la API metrics requiere autenticación', async ({ request }) => {
    const response = await request.get('/api/admin/delivery/metrics?business_id=00000000-0000-4000-8000-000000000000')
    expect(response.ok()).toBe(false)
  })
})
