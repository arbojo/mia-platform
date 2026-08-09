import { test, expect } from '@playwright/test'

test.describe('PWA offline-first del Portal del Repartidor', () => {
  test('el sw.js se sirve como JavaScript válido', async ({ request }) => {
    const response = await request.get('/sw.js')
    expect(response.ok()).toBe(true)
    const body = await response.text()
    expect(body).toContain('self.addEventListener')
    expect(body).toContain('mia-shell-${VERSION}')
  })

  test('el service worker se registra y controla el portal', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Registro de SW validado solo en Chromium')

    await page.goto('/driver/login')
    await page.waitForFunction(
      async () => {
        if (!('serviceWorker' in navigator)) return false
        const registration = await navigator.serviceWorker.ready
        return registration?.active != null
      },
      undefined,
      { timeout: 10_000 }
    )

    const registrations = await page.evaluate(async () => {
      const regs = await navigator.serviceWorker.getRegistrations()
      return regs.map((r) => r.scope)
    })
    expect(registrations.some((scope) => scope.endsWith('/driver/'))).toBe(true)
  })
})
