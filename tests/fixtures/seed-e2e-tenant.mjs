/**
 * TRUE_E2E deterministic tenant seeder.
 *
 * Creates (idempotently): auth user -> business -> brand identity ->
 * assistant -> product -> knowledge item with conditional media trigger.
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY from .env.local (never printed).
 * Run: node tests/fixtures/seed-e2e-tenant.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const FIXTURE_PATH = join(__dirname, '.e2e-tenant.json')

// Las credenciales salen de .env.local en local, pero en CI solo existen como
// variables de entorno. Se leen ambas fuentes y process.env gana, asi el mismo
// script sirve para sembrar el tenant en los dos lados sin editar nada.
const envFilePath = join(ROOT, '.env.local')
const fileEnv = existsSync(envFilePath)
  ? Object.fromEntries(
      readFileSync(envFilePath, 'utf8')
        .split(/\r?\n/)
        .filter((line) => line.trim() && !line.trim().startsWith('#'))
        .map((line) => {
          const idx = line.indexOf('=')
          return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()]
        })
    )
  : {}

const env = { ...fileEnv, ...process.env }

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'FATAL: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes ' +
      '(.env.local o process.env)'
  )
  process.exit(1)
}

const EMAIL = 'e2e-test-owner@mia-platform.com'
const PASSWORD = 'test-password-123'

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // ------------------------------------------------------------------
  // 1. Auth user (find or create, confirmed)
  // ------------------------------------------------------------------
  let userId
  const listed = await admin.auth.admin.listUsers({ perPage: 500 })
  const existing = listed.data?.users?.find((u) => u.email === EMAIL)

  if (existing) {
    userId = existing.id
    console.log(`[seed] auth user found: ${userId}`)
  } else {
    const created = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    })
    if (created.error) throw created.error
    userId = created.data.user.id
    console.log(`[seed] auth user CREATED: ${userId}`)
  }

  // ------------------------------------------------------------------
  // 2. Business
  // ------------------------------------------------------------------
  let businessId
  const foundBiz = await admin
    .from('businesses')
    .select('id')
    .eq('owner_id', userId)
    .eq('name', 'E2E Test Business')
    .maybeSingle()

  if (foundBiz.data) {
    businessId = foundBiz.data.id
    console.log(`[seed] business found: ${businessId}`)
  } else {
    const insBiz = await admin
      .from('businesses')
      .insert({ owner_id: userId, name: 'E2E Test Business', onboarding_status: 'ready' })
      .select('id')
      .single()
    if (insBiz.error) throw insBiz.error
    businessId = insBiz.data.id
    console.log(`[seed] business CREATED: ${businessId}`)
  }

  // ------------------------------------------------------------------
  // 3. Brand identity (context builder reads this table)
  // ------------------------------------------------------------------
  const upBrand = await admin.from('brand_identities').upsert(
    {
      business_id: businessId,
      business_name: 'E2E Test Business',
      tagline: 'Validacion E2E de MIA',
      target_customers: 'Clientes de prueba automatizados',
      differentiators: 'Datos deterministas para pruebas',
      elevator_pitch:
        'Negocio sintetico usado por la suite TRUE_E2E para validar el flujo completo de venta con medios.',
      tone_of_voice: 'calido',
    },
    { onConflict: 'business_id' }
  )
  if (upBrand.error) throw upBrand.error
  console.log('[seed] brand identity ok')

  // ------------------------------------------------------------------
  // 4. Assistant
  //    `status` DEBE ser 'ready': canServeTraffic() (assistant-gate.ts) solo
  //    permite 'ready' | 'active', y el default de la columna es 'draft'.
  //    Un assistant sembrado sin status queda bloqueado para siempre.
  // ------------------------------------------------------------------
  const foundAsst = await admin
    .from('assistants')
    .select('id, status, is_active')
    .eq('business_id', businessId)
    .eq('name', 'E2E Test Assistant')
    .maybeSingle()

  let assistantId
  if (foundAsst.data) {
    assistantId = foundAsst.data.id
    console.log(`[seed] assistant found: ${assistantId} (status=${foundAsst.data.status})`)

    if (foundAsst.data.status !== 'ready' || foundAsst.data.is_active !== true) {
      const fixed = await admin
        .from('assistants')
        .update({ status: 'ready', is_active: true })
        .eq('id', assistantId)
        .select('status, is_active')
        .single()
      if (fixed.error) throw fixed.error
      console.log(`[seed] assistant REPAIRED -> status=${fixed.data.status} is_active=${fixed.data.is_active}`)
    }
  } else {
    const insAsst = await admin
      .from('assistants')
      .insert({
        business_id: businessId,
        name: 'E2E Test Assistant',
        personality: { warmth: 50, formality: 50, humor: 20, sales_aggressiveness: 40 },
        communication_style: 'warm',
        is_active: true,
        status: 'ready',
      })
      .select('id')
      .single()
    if (insAsst.error) throw insAsst.error
    assistantId = insAsst.data.id
    console.log(`[seed] assistant CREATED: ${assistantId}`)
  }

  // ------------------------------------------------------------------
  // 5. Product
  // ------------------------------------------------------------------
  const foundProd = await admin
    .from('products')
    .select('id')
    .eq('business_id', businessId)
    .eq('name', 'E2E Test Neurofeet')
    .maybeSingle()

  let productId
  if (foundProd.data) {
    productId = foundProd.data.id
    console.log(`[seed] product found: ${productId}`)
  } else {
    const insProd = await admin
      .from('products')
      .insert({
        business_id: businessId,
        name: 'E2E Test Neurofeet',
        price: 499.0,
        description: 'Producto de prueba E2E para validar la resolucion de productos de MIA.',
        benefits: 'Alivio del dolor, mejora de la movilidad.',
        faq: [{ q: '¿Cómo se usa?', a: 'Se usa según indicaciones.' }],
        image_url:
          'https://xyz.supabase.co/storage/v1/object/public/media/e2e-test-neurofeet.jpg',
        is_active: true,
      })
      .select('id')
      .single()
    if (insProd.error) throw insProd.error
    productId = insProd.data.id
    console.log(`[seed] product CREATED: ${productId}`)
  }

  // ------------------------------------------------------------------
  // 6. Knowledge item with conditional media trigger
  // ------------------------------------------------------------------
  const foundKi = await admin
    .from('knowledge_items')
    .select('id')
    .eq('business_id', businessId)
    .eq('trigger_condition', 'E2E Test Neurofeet')
    .maybeSingle()

  if (foundKi.data) {
    console.log(`[seed] knowledge item found: ${foundKi.data.id}`)
  } else {
    const insKi = await admin.from('knowledge_items').insert({
      business_id: businessId,
      product_id: productId,
      category: 'faq',
      question: '¿Cuáles son los beneficios del E2E Test Neurofeet?',
      answer:
        'Los beneficios del E2E Test Neurofeet incluyen alivio del dolor y mejora de la movilidad.',
      trigger_condition: 'E2E Test Neurofeet',
      image_url:
        'https://xyz.supabase.co/storage/v1/object/public/media/e2e-test-neurofeet.jpg',
      media_type: 'image',
      confidence: 'high',
      is_active: true,
      source: 'manual',
    })
    if (insKi.error) throw insKi.error
    console.log('[seed] knowledge item CREATED')
  }

  // ------------------------------------------------------------------
  // 7. Fixture file: los IDs se publican en disco para que los specs no los
  //    hardcodeen. Un ID quemado en el spec se pudre en cuanto el tenant se
  //    borra, y el E2E falla sin explicar por que.
  // ------------------------------------------------------------------
  const fixture = {
    email: EMAIL,
    password: PASSWORD,
    businessId,
    assistantId,
    productId,
    productName: 'E2E Test Neurofeet',
    productPrice: 499,
  }
  writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2) + '\n')
  console.log(`[seed] fixture written: ${FIXTURE_PATH}`)

  console.log('\n=== SEED COMPLETE ===')
  console.log(`login: ${EMAIL} / ${PASSWORD}`)
  console.log(`business: ${businessId} | assistant: ${assistantId} | product: ${productId}`)
}

main().catch((err) => {
  console.error('[seed] FAILED:', err.message ?? err)
  process.exit(1)
})
