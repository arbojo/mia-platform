/**
 * MIA SALES CORE - TRUE_E2E Validation
 *
 * Loop Engineering Iteration 1.
 * Proves: USER MESSAGE -> PRODUCT RESOLUTION -> PRODUCT DATA ->
 *         MEDIA DECISION -> MEDIA DISPATCH -> CLIENT-VISIBLE RESPONSE
 *
 * Entry point: /widget?assistantId=... -- the same entry point a real
 * customer uses (no mocks, no API shortcuts). The request flows through
 * POST /api/widget/chat -> processStreaming() -> OpenAI gpt-4o-mini.
 *
 * Tenant seeded by tests/fixtures/seed-e2e-tenant.mjs, which writes
 * tests/fixtures/.e2e-tenant.json. The IDs are READ from that file, never
 * hardcoded: a burned-in assistant ID silently rots the moment the tenant is
 * deleted, and the spec then fails without saying why.
 *
 *   node tests/fixtures/seed-e2e-tenant.mjs
 */

import { test, expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Playwright corre desde la raiz del proyecto (testDir es './tests/e2e'),
// asi que la ruta del fixture se resuelve contra process.cwd().
const FIXTURE = join(process.cwd(), 'tests', 'fixtures', '.e2e-tenant.json')

type Tenant = {
  email: string
  password: string
  businessId: string
  assistantId: string
  productId: string
  productName: string
  productPrice: number
}

function loadTenant(): Tenant | null {
  if (!existsSync(FIXTURE)) return null
  return JSON.parse(readFileSync(FIXTURE, 'utf8')) as Tenant
}

const tenant = loadTenant()

/**
 * El service role vive en .env.local (gitignored), no en el entorno de
 * Playwright. Se parsea aqui para poder verificar en DB que el cierre
 * escribio SALE_WON/SALE_CONFIRMED y el outcome de la conversacion.
 * process.env gana sobre el archivo para que CI pueda sobreescribirlo.
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

const env: Record<string, string | undefined> = {
  ...loadEnvFile(),
  ...process.env,
}

/** null cuando no hay service role: el funnel de navegador igual corre. */
function createAdmin(): SupabaseClient | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

const admin = createAdmin()

// Sin tenant sembrado no hay nada que verificar. Se salta con el motivo
// explicito en vez de fallar con un error de selector sin contexto.
test.skip(
  tenant === null,
  'Tenant E2E ausente. Generalo con: node tests/fixtures/seed-e2e-tenant.mjs'
)

const PRODUCT_QUESTION = `Quiero ver el ${tenant?.productName}`
const PRODUCT_NAME = tenant?.productName ?? ''
const PRICE = `$${tenant?.productPrice}`

// Dispara intent 'price' (src/lib/runtime/intents.ts) => el route setea
// X-MIA-Sales-Intent: 1 => ChatWindow renderiza el CTA de compra.
const PRICE_QUESTION = 'Hola, cual es el precio exacto?'
// Objeccion tipica de precio: la classifies como OBJECTION_DETECTED el LLM
// de deteccion (src/lib/sales/detect.ts), que no es determinista, asi que se
// registra como evidencia y no como assert duro.
const OBJECTION_MESSAGE = 'Sino me parece muy caro, y si no me convence lo dejo para otro dia'

test.describe('MIA Sales Core E2E - TRUE_E2E Validation', () => {
  test('customer asks about a product and receives product data + media in the visible response',
    async ({ page }) => {
      // ==========================================================
      // PHASE 1: Real customer entry point
      // ==========================================================
      await page.goto(`/widget?assistantId=${tenant!.assistantId}&name=${encodeURIComponent('E2E Test Assistant')}`)

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

      // Product card renders price as ${price} => "$499" (seeded fixture price)
      const priceTag = page.getByText(PRICE, { exact: true })
      await expect(priceTag).toBeVisible({ timeout: 15000 })
      console.log('[FORENSICS] product card visible with price', PRICE)

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
      console.log(`PRODUCT_DATA        : price ${tenant!.productPrice} rendered by ProductMessageCard`)
      console.log('MEDIA_DECISION      : trigger_condition matched, media emitted by runtime')
      console.log(`MEDIA_DISPATCH      : imageUrl=${imageSrc}`)
      console.log('CLIENT_VISIBLE      : product card + media image rendered in widget DOM')
    })

  test('customer raises an objection, then closes the sale from the widget CTA', async ({ page }) => {
    // El CTA de ChatWindow solo existe con landingContext + el header
    // X-MIA-Sales-Intent, asi que el widget se abre como en produccion con
    // landingId + productId.
    const widgetUrl =
      `/widget?assistantId=${tenant!.assistantId}` +
      `&name=${encodeURIComponent('E2E Test Assistant')}` +
      `&landingId=e2e-landing` +
      `&productId=${tenant!.productId}` +
      `&product=${encodeURIComponent(PRODUCT_NAME)}` +
      `&brand=E2E`

    // El conversationId solo existe en la respuesta del servidor; se captura
    // del header para poder verificar los eventos en DB.
    let conversationId: string | null = null
    page.on('response', (response) => {
      if (!response.url().includes('/api/widget/chat')) return
      const header = response.headers()['x-mia-conversation-id']
      if (header) conversationId = header
    })

    await page.goto(widgetUrl)
    const input = page.getByPlaceholder('Escribe tu mensaje...')
    await expect(input).toBeVisible({ timeout: 20000 })

    const bubbles = page.locator('p.whitespace-pre-wrap')

    // ---------------------------------------------------------
    // TURN 1: objecion
    // ---------------------------------------------------------
    await input.fill(OBJECTION_MESSAGE)
    await input.press('Enter')
    await expect(bubbles).toHaveCount(2, { timeout: 60000 })
    await expect(input).toBeEnabled({ timeout: 60000 })

    // ---------------------------------------------------------
    // TURN 2: pregunta de precio -> intent 'price' -> CTA
    // ---------------------------------------------------------
    await input.fill(PRICE_QUESTION)
    await input.press('Enter')
    await expect(bubbles).toHaveCount(4, { timeout: 60000 })
    await expect(input).toBeEnabled({ timeout: 60000 })

    expect(conversationId).toBeTruthy()
    console.log('[FORENSICS] conversationId from X-MIA-Conversation-Id:', conversationId)

    // ---------------------------------------------------------
    // PHASE: CTA de compra (id estable en ChatWindow)
    // ---------------------------------------------------------
    const buyButton = page.locator('#btn-comprar-mia')
    await expect(buyButton).toBeVisible({ timeout: 20000 })
    await expect(buyButton).toHaveText('Comprar ahora', { timeout: 20000 })

    // ---------------------------------------------------------
    // PHASE: cierre manual -> POST /api/widget/close
    // ---------------------------------------------------------
    await buyButton.click()
    await expect(buyButton).toHaveText('Pedido registrado ✓', { timeout: 30000 })

    // ---------------------------------------------------------
    // PHASE: verificacion en DB del funnel de ventas
    // ---------------------------------------------------------
    if (!admin) {
      console.log(
        '[E2E] SUPABASE_SERVICE_ROLE_KEY ausente: no se verifican sales_events en DB'
      )
      return
    }

    const { data: events, error: eventsError } = await admin
      .from('sales_events')
      .select('id, event_type, amount, product_id, metadata')
      .eq('conversation_id', conversationId!)
      .order('created_at', { ascending: true })

    expect(eventsError).toBeNull()
    const eventTypes = (events ?? []).map((e) => e.event_type)
    console.log('[FORENSICS] sales_events:', JSON.stringify(eventTypes))

    const won = (events ?? []).find((e) => e.event_type === 'SALE_WON')
    expect(won, 'SALE_WON no fue emitido por /api/widget/close').toBeDefined()
    // El monto NO viene del body del cliente: se resuelve desde el producto
    // de landingContext en la DB, asi que debe ser el precio sembrado.
    expect(won!.amount).toBe(tenant!.productPrice)
    expect(won!.product_id).toBe(tenant!.productId)
    expect(won!.metadata).toMatchObject({ source: 'widget', channel: 'widget' })

    // El widget no crea fila en delivery.orders ni persiste order_id
    // (events.ts solo lo guarda cuando C1 lo provee), asi que el numero de
    // orden se deriva del id del SALE_WON y viaja en el metadata de
    // SALE_CONFIRMED junto con el texto de confirmacion enviado al cliente.
    const confirmed = (events ?? []).find((e) => e.event_type === 'SALE_CONFIRMED')
    expect(confirmed, 'SALE_CONFIRMED no fue emitido').toBeDefined()

    const expectedOrderNumber = `VTA-${won!.id.slice(0, 6).toUpperCase()}`
    const confirmedMeta = confirmed!.metadata as Record<string, unknown>
    expect(confirmedMeta.original_sale_event_id).toBe(won!.id)
    expect(confirmedMeta.order_number).toBe(expectedOrderNumber)

    const confirmationMessage = String(confirmedMeta.confirmation_message ?? '')
    expect(confirmationMessage).toContain(expectedOrderNumber)
    expect(confirmationMessage).toContain(String(tenant!.productPrice))
    expect(confirmationMessage).toContain(PRODUCT_NAME)

    // La deteccion de objecion la hace el LLM (src/lib/sales/detect.ts), asi
    // que se reporta como evidencia sin bloquear el test por flakiness.
    const objectionDetected = eventTypes.includes('OBJECTION_DETECTED')
    console.log(
      `[E2E] OBJECTION_DETECTED por LLM: ${objectionDetected ? 'si' : 'no (no determinista)'}`
    )

    const { data: conversation, error: convError } = await admin
      .from('conversations')
      .select('outcome, deal_value')
      .eq('id', conversationId!)
      .single()

    expect(convError).toBeNull()
    expect(conversation!.outcome).toBe('sold')
    expect(conversation!.deal_value).toBe(tenant!.productPrice)

    console.log('=== SALES FUNNEL COMPLETE ===')
    console.log(`CONVERSATION        : ${conversationId}`)
    console.log('OBJECTION_TURN      : objection sent, pipeline continued without crash')
    console.log('SALES_INTENT_HEADER : X-MIA-Sales-Intent=1 -> CTA "Comprar ahora"')
    console.log('CTA_CLICK           : POST /api/widget/close -> "Pedido registrado"')
    console.log(`SALE_WON            : amount=${won!.amount} product=${won!.product_id}`)
    console.log(`ORDER               : ${expectedOrderNumber} (derivado del SALE_WON, sin delivery.orders)`)
    console.log('SALE_CONFIRMED      : confirmation event emitted con el total y el producto')
    console.log(`CONVERSATION_OUTCOME: ${conversation!.outcome} deal_value=${conversation!.deal_value}`)
  })
})
