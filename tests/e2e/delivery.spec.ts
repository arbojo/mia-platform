import { test, expect } from '@playwright/test'

test.describe('Portal del Repartidor (público)', () => {
  test('login sin token muestra el aviso de enlace', async ({ page }) => {
    await page.goto('/driver/login')
    await expect(
      page.getByText('Accedé con el enlace que te envió tu administrador.')
    ).toBeVisible()
  })

  test('login con token inválido es rechazado y redirige al aviso', async ({ page }) => {
    await page.goto(
      '/driver/login?t=token-invalido-abcdefghijklmnopqrstuvwxyz&d=00000000-0000-4000-8000-000000000000'
    )
    await page.waitForURL(/\/driver\/login$/, { timeout: 15_000 })
    await expect(
      page.getByText('Accedé con el enlace que te envió tu administrador.')
    ).toBeVisible()
  })

  test('la home sin sesión redirige al login', async ({ page }) => {
    await page.goto('/driver')
    await page.waitForURL(/\/driver\/login/, { timeout: 20_000 })
    await expect(
      page.getByText('Accedé con el enlace que te envió tu administrador.')
    ).toBeVisible()
  })

  test('el detalle de entrega sin sesión redirige al login', async ({ page }) => {
    await page.goto('/driver/deliveries/00000000-0000-4000-8000-000000000000')
    await page.waitForURL(/\/driver\/login/, { timeout: 20_000 })
  })

  test('el encabezado del portal se renderiza', async ({ page }) => {
    await page.goto('/driver/login')
    await expect(page.getByText('MIA Delivery')).toBeVisible()
    await expect(page.getByText('Portal del Repartidor')).toBeVisible()
  })
})

test.describe('PWA del portal', () => {
  test('el manifest se sirve como JSON válido con start_url /driver', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest')
    expect(response.ok()).toBe(true)
    const manifest = (await response.json()) as {
      start_url?: string
      name?: string
      display?: string
    }
    expect(manifest.start_url).toBe('/driver')
    expect(manifest.name).toBeTruthy()
    expect(manifest.display).toBeTruthy()
  })
})

test.describe('Sección admin Delivery (sin autenticar)', () => {
  test('redirige a login desde /dashboard/delivery', async ({ page }) => {
    await page.goto('/dashboard/delivery')
    await page.waitForURL(/.*login.*/, { timeout: 10_000 })
    expect(page.url()).toContain('login')
  })
})
