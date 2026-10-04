import { test, expect } from '@playwright/test'

// El login delega en Supabase para decidir si muestra error. Con la URL
// placeholder de CI no hay backend al que preguntar, asi que la pagina no
// renderiza nada y el test mide el ambiente, no el producto.
const SUPABASE_IS_PLACEHOLDER = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').includes('placeholder')

test.describe('Autenticación', () => {
  test('login page muestra formulario completo', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('Bienvenido a MIA')).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Contraseña', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /ingresar/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /crear cuenta/i })).toBeVisible()
  })

  test('login muestra error con credenciales invalidas', async ({ page }) => {
    test.skip(SUPABASE_IS_PLACEHOLDER, 'requiere Supabase real para que el login renderice el error')
    await page.goto('/login')
    await page.getByLabel('Email').fill('qa-invalid@example.com')
    await page.getByLabel('Contraseña', { exact: true }).fill('invalid-password-123')
    await page.getByRole('button', { name: /ingresar/i }).click()
    await expect(page.locator('text=/invalid|error/i').first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test('signup page enlaza de vuelta al login', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByRole('link', { name: /iniciar sesión/i })).toBeVisible()
    await page.goto('/login')
    await expect(page.getByText('Bienvenido a MIA')).toBeVisible()
  })
})

test.describe('Dashboard (unauthenticated)', () => {
  test('redirige a login desde /dashboard', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL(/.*login.*/, { timeout: 10_000 })
    expect(page.url()).toContain('login')
  })
})
