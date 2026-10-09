import { test, expect } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIABETIC_ID = '88beef61-0361-4e86-b024-5e48bab063f1'

/**
 * Las credenciales y la imagen viven en el entorno (o en .env.local, gitignored),
 * nunca en el repo: un email/password real commiteado es una credencial filtrada,
 * y una ruta tipo C:/Users/... rompe CI en cuanto la imagen no existe.
 * Playwright no carga .env.local por su cuenta, asi que se parsea aqui; process.env
 * gana sobre el archivo para que CI pueda sobreescribirlo.
 */
function loadEnvFile(): Record<string, string> {
  const path = join(process.cwd(), '.env.local')
  if (!existsSync(path)) return {}
  const parsed: Record<string, string> = {}
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    parsed[key] = value
  }
  return parsed
}

const env: Record<string, string | undefined> = { ...loadEnvFile(), ...process.env }
const EMAIL = env.E2E_USER_EMAIL
const PASSWORD = env.E2E_USER_PASSWORD
const IMAGE = env.E2E_DIABETIC_IMAGE

test.describe('Diabetic Patch image upload', () => {
  test.skip(
    !EMAIL || !PASSWORD || !IMAGE,
    'Requiere E2E_USER_EMAIL, E2E_USER_PASSWORD y E2E_DIABETIC_IMAGE (ruta local a una imagen).'
  )

  test('upload image to Diabetic Patch product', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(EMAIL as string)
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD as string)
    await page.getByRole('button', { name: /ingresar/i }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })

    await page.goto(`/dashboard/catalog/${DIABETIC_ID}`)
    await expect(page.getByRole('heading', { name: /diabetic patch/i })).toBeVisible({
      timeout: 10000,
    })

    await page.getByRole('button', { name: /editar/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })

    const fileInput = page.locator('input[type="file"][accept*="image"]')
    await expect(fileInput).toBeAttached()

    await fileInput.setInputFiles(IMAGE as string)

    await page.getByRole('button', { name: /guardar cambios/i }).click()
    await expect(page.getByText(/producto guardado/i)).toBeVisible({ timeout: 10000 })
  })
})
