/**
 * MIA SALES CORE - TRUE_E2E VALIDATION
 *
 * Loop Engineering Iteration 1.
 * Proves: USER MESSAGE -> PRODUCT RESOLUTION -> PRODUCT DATA ->
 *         MEDIA DECISION -> MEDIA DISPATCH -> CLIENT-VISIBLE RESPONSE
 *
 * Entry point: /widget?assistantId=... -- the same entry point a real
 * customer uses (no mocks, no API shortcuts). The request flows through
 * POST /api/widget/chat -> processStreaming() -> OpenAI gpt-4o-mini.
 *
 * Deterministic tenant seeded by tests/fixtures/seed-e2e-tenant.mjs:
 *   business  d839de7e-0c17-4d5f-9519-f55a50fa71ae
 *   assistant 2cec2443-c5ac-4299-b713-0981d9e734b3
 *   product   "E2E Test Neurofeet" (price 499, conditional media trigger)
 */

import { test, expect } from '@playwright/test'

const ASSISTANT_ID = '2cec2443-c5ac-4299-b713-0981d9e734b3'
const PRODUCT_QUESTION = 'Quiero ver el E2E Test Neurofeet'
const PRODUCT_NAME = 'E2E Test Neurofeet'

test.describe('MIA Sales Core E2E - TRUE_E2E Validation', () => {
  test('customer asks about a product and receives product data + media in the visible response',
    async ({ page }) => {
      // ==========================================================
      // PHASE 1: Real customer entry point
      // ==========================================================
      await page.goto(`/widget?assistantId=${ASSISTANT_ID}&name=${encodeURIComponent('E2E Test Assistant')}`)

      const input = page.getByPlaceholder('Escribe tu mensaje...')
      await expect(input).toBeVisible({ timeout: 20000 })

      // ==========================================================
      // PHASE 2: USER MESSAGE
      // ==========================================================
      await input.fill(PRODUCT_QUESTION)
      await input.press('Enter')

      // User bubble must appear client-side
      const userBubble = page.locator('p.whitespace-pre-wrap', { hasText: PRODUCT_QUESTION })
      await expect(userBubble).toBeVisible({ timeout: 10000 })

      // ==========================================================
      // PHASE 3: CLIENT-VISIBLE RESPONSE (streams via SSE)
      // Wait for the assistant reply (a second message paragraph).
      // ==========================================================
      const allMessages = page.locator('p.whitespace-pre-wrap')
      await expect(allMessages).toHaveCount(2, { timeout: 60000 })

      // Stream completion signal: the input is disabled only while isLoading
      await expect(input).toBeEnabled({ timeout: 60000 })

      const assistantText = (await allMessages.nth(1).textContent()) ?? ''
      console.log('[FORENSICS] assistant response text:', JSON.stringify(assistantText.slice(0, 300)))
      expect(assistantText.length).toBeGreaterThan(10)

      // ==========================================================
      // PHASE 4: PRODUCT RESOLUTION + PRODUCT DATA (ProductMessageCard)
      // ==========================================================
      // Product name must be part of the visible journey
      await expect(page.getByText(PRODUCT_NAME).first()).toBeVisible({ timeout: 15000 })

      // Product card renders price as ${price} => "$499"
      const priceTag = page.getByText('$499', { exact: true })
      await expect(priceTag).toBeVisible({ timeout: 15000 })
      console.log('[FORENSICS] product card visible with price $499')

      // ==========================================================
      // PHASE 5: MEDIA DECISION -> MEDIA DISPATCH -> CLIENT RECEIPT
      // ChatWindow renders media as <img alt="Imagen enviada por el asistente">
      // only when the runtime emitted a media SSE event.
      // ==========================================================
      const mediaImage = page.locator('img[alt="Imagen enviada por el asistente"]')
      await expect(mediaImage).toHaveCount(1, { timeout: 15000 })

      const imageSrc = await mediaImage.getAttribute('src')
      console.log('[FORENSICS] media dispatched imageUrl:', imageSrc)

      expect(imageSrc).toBeTruthy()
      expect(imageSrc!).toContain('e2e-test-neurofeet')
      expect(imageSrc!).toContain('/storage/v1/object/public/media/')

      // ==========================================================
      // FORENSICS SUMMARY
      // ==========================================================
      console.log('=== TRUE_E2E JOURNEY COMPLETE ===')
      console.log(`USER_MESSAGE        : "${PRODUCT_QUESTION}"`)
      console.log('PRODUCT_RESOLUTION  : E2E Test Neurofeet resolved from knowledge/product context')
      console.log('PRODUCT_DATA        : price 499 rendered by ProductMessageCard')
      console.log('MEDIA_DECISION      : trigger_condition matched, media emitted by runtime')
      console.log(`MEDIA_DISPATCH      : imageUrl=${imageSrc}`)
      console.log('CLIENT_VISIBLE      : product card + media image rendered in widget DOM')
    })
})
