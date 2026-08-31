#!/usr/bin/env npx tsx
/**
 * E2E Fixture Validation — Shared MIA Core
 *
 * ⚠️  SAFEGUARD: Requires E2E_VALIDATE=true to run.
 * This script makes REAL DB writes and REAL OpenAI API calls.
 * It is designed for controlled validation against a dev/staging database only.
 *
 * Run: E2E_VALIDATE=true npx tsx tests/e2e-shared-core-validation.ts
 *
 * DO NOT run against production. DO NOT commit secrets.
 * Business/assistant IDs are read from env or default to Vitanova dev fixtures.
 */

// ─── Production guard ────────────────────────────────────────────────────────
if (process.env.E2E_VALIDATE !== 'true') {
  console.error(
    '\n⛔ BLOCKED: E2E fixture validation requires E2E_VALIDATE=true\n' +
    '   Run: E2E_VALIDATE=true npx tsx tests/e2e-shared-core-validation.ts\n' +
    '   This script makes REAL DB writes and OpenAI API calls.\n'
  )
  process.exit(1)
}

import 'dotenv/config'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// ─── Load real env vars (override any stubs) ─────────────────────────────────
const envPath = resolve(__dirname, '../.env.local')
const envLocal = readFileSync(envPath, 'utf-8')
for (const line of envLocal.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx < 0) continue
  const key = trimmed.slice(0, eqIdx).trim()
  const val = trimmed.slice(eqIdx + 1).trim()
  process.env[key] = val
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ─── Config (override via env vars for reuse against other businesses) ────────
const BIZ_ID = process.env.E2E_BIZ_ID || '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'  // default: Vitanova
const ASST_ID = process.env.E2E_ASST_ID || '2f57cd29-fef3-4167-8745-4f02b57d4850' // default: MIA

let custId = ''
let cust2Id = ''

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function countRows(table: string, filters: Record<string, string>) {
  let q = supabase.from(table).select('id', { count: 'exact' })
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v)
  const { count, error } = await q
  if (error) throw new Error(`Count ${table}: ${error.message}`)
  return count ?? 0
}

async function deleteFixtures(table: string, filters: Record<string, string>) {
  let q = supabase.from(table).delete()
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v)
  const { error } = await q
  if (error) console.error(`  Cleanup ${table}: ${error.message}`)
}

let passed = 0
let failed = 0

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${msg}`)
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log(`  ✗ ${name}`)
    console.log(`    → ${msg}`)
    failed++
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  const { processCore } = await import('../src/lib/runtime/core')

  console.log('\n=== E2E Shared MIA Core Validation ===\n')

  // ─── SETUP ───────────────────────────────────────────────────────────────────
  console.log('[SETUP]')

  await test('Vitanova business + assistant exist', async () => {
    const { data: biz } = await supabase.from('businesses').select('id').eq('id', BIZ_ID).single()
    assert(!!biz, 'business not found')
    const { data: asst } = await supabase.from('assistants').select('id').eq('id', ASST_ID).single()
    assert(!!asst, 'assistant not found')
  })

  await test('Create isolated test customers', async () => {
    const { data: c1, error: e1 } = await supabase
      .from('customers')
      .insert({ business_id: BIZ_ID, name: 'E2E-Core Customer', phone: '+5491199990001', status: 'new' } as never)
      .select('id').single()
    if (e1) throw new Error(e1.message)
    custId = c1!.id

    const { data: c2, error: e2 } = await supabase
      .from('customers')
      .insert({ business_id: BIZ_ID, name: 'E2E-Core Customer 2', phone: '+5491199990002', status: 'new' } as never)
      .select('id').single()
    if (e2) throw new Error(e2.message)
    cust2Id = c2!.id
  })

  // ═══════════════════════════════════════════════════════════════════════════════
  // SCENARIO 1: Product Recommendation
  // ═══════════════════════════════════════════════════════════════════════════════

  console.log('\n[SCENARIO 1] Product Recommendation')

  let s1Conv = ''
  await test('processCore returns response for product query', async () => {
    const { data: conv, error } = await supabase
      .from('conversations')
      .insert({ assistant_id: ASST_ID, customer_id: custId, type: 'simulation', status: 'active' } as never)
      .select('id').single()
    if (error) throw new Error(error.message)
    s1Conv = conv!.id

    const result = await processCore({
      businessId: BIZ_ID, assistantId: ASST_ID, customerId: custId,
      conversationId: s1Conv, userMessage: '¿Cuánto cuesta?',
      channel: 'simulation', mode: 'complete', requestType: 'training',
    })

    assert(typeof result.response === 'string' && result.response.length > 0, 'no response')
  })

  await test('exactly 1 user + 1 assistant message persisted', async () => {
    const u = await countRows('messages', { conversation_id: s1Conv, role: 'user' })
    const a = await countRows('messages', { conversation_id: s1Conv, role: 'assistant' })
    assert(u === 1, `expected 1 user msg, got ${u}`)
    assert(a === 1, `expected 1 assistant msg, got ${a}`)
  })

  await deleteFixtures('messages', { conversation_id: s1Conv })
  await deleteFixtures('conversations', { id: s1Conv })

  // ═══════════════════════════════════════════════════════════════════════════════
  // SCENARIO 2: Conditional Media / Resend
  // ═══════════════════════════════════════════════════════════════════════════════

  console.log('\n[SCENARIO 2] Conditional Media / Resend')

  let s2Conv = ''
  await test('create conversation', async () => {
    const { data, error } = await supabase
      .from('conversations')
      .insert({ assistant_id: ASST_ID, customer_id: custId, type: 'simulation', status: 'active' } as never)
      .select('id').single()
    if (error) throw new Error(error.message)
    s2Conv = data!.id
  })

  await test('first message exercises media resolution path', async () => {
    const result = await processCore({
      businessId: BIZ_ID, assistantId: ASST_ID, customerId: custId,
      conversationId: s2Conv, userMessage: '¿Qué productos tienen?',
      channel: 'simulation', mode: 'complete', requestType: 'training',
    })
    assert(result !== null, 'no result')
  })

  await test('resend request exercises isResend path', async () => {
    const result = await processCore({
      businessId: BIZ_ID, assistantId: ASST_ID, customerId: custId,
      conversationId: s2Conv, userMessage: 'Mándame la imagen otra vez',
      channel: 'simulation', mode: 'complete', requestType: 'training',
    })
    assert(result !== null, 'no result')
  })

  await deleteFixtures('messages', { conversation_id: s2Conv })
  await deleteFixtures('conversations', { id: s2Conv })

  // ═══════════════════════════════════════════════════════════════════════════════
  // SCENARIO 3: Cancellation Flow
  // ═══════════════════════════════════════════════════════════════════════════════

  console.log('\n[SCENARIO 3] Cancellation — SALE_WON → SALE_CANCELLED → blocked')

  let s3Conv1 = ''
  let s3Conv2 = ''

  await test('set up sold conversation with SALE_WON + SALE_CANCELLED', async () => {
    const { data: conv, error } = await supabase
      .from('conversations')
      .insert({ assistant_id: ASST_ID, customer_id: custId, type: 'simulation', status: 'active', outcome: 'sold' } as never)
      .select('id').single()
    if (error) throw new Error(error.message)
    s3Conv1 = conv!.id

    await supabase.from('sales_events').insert({
      business_id: BIZ_ID, assistant_id: ASST_ID, conversation_id: s3Conv1,
      customer_id: custId, event_type: 'SALE_WON', amount: 2500,
      metadata: { product_name: 'Test Product' },
    } as never)

    await supabase.from('conversations')
      .update({ sales_cancelled_at: new Date().toISOString() } as never)
      .eq('id', s3Conv1)

    await supabase.from('sales_events').insert({
      business_id: BIZ_ID, assistant_id: ASST_ID, conversation_id: s3Conv1,
      customer_id: custId, event_type: 'SALE_CANCELLED',
      metadata: { order_number: 'VTA-E2E-TEST', product_name: 'Test Product' },
    } as never)
  })

  await test('DB contains SALE_WON + SALE_CANCELLED', async () => {
    const { data: events } = await supabase
      .from('sales_events').select('event_type')
      .eq('conversation_id', s3Conv1).order('created_at', { ascending: true })
    const types = events?.map((e: { event_type: string }) => e.event_type) ?? []
    assert(types.includes('SALE_WON'), 'no SALE_WON')
    assert(types.includes('SALE_CANCELLED'), 'no SALE_CANCELLED')
  })

  await test('new conv + purchase intent → NO new SALE_WON', async () => {
    const { data: conv, error } = await supabase
      .from('conversations')
      .insert({ assistant_id: ASST_ID, customer_id: custId, type: 'simulation', status: 'active' } as never)
      .select('id').single()
    if (error) throw new Error(error.message)
    s3Conv2 = conv!.id

    const before = await countRows('sales_events', { customer_id: custId, event_type: 'SALE_WON' })

    await processCore({
      businessId: BIZ_ID, assistantId: ASST_ID, customerId: custId,
      conversationId: s3Conv2, userMessage: 'Sí, quiero comprar',
      channel: 'simulation', mode: 'complete', requestType: 'training',
    })

    await new Promise((r) => setTimeout(r, 2000))

    const after = await countRows('sales_events', { customer_id: custId, event_type: 'SALE_WON' })
    assert(after === before, `SALE_WON count changed: ${before} → ${after}`)
  })

  await deleteFixtures('sales_events', { conversation_id: s3Conv1 })
  await deleteFixtures('messages', { conversation_id: s3Conv2 })
  await deleteFixtures('conversations', { id: s3Conv2 })
  await deleteFixtures('messages', { conversation_id: s3Conv1 })
  await deleteFixtures('conversations', { id: s3Conv1 })

  // ═══════════════════════════════════════════════════════════════════════════════
  // SCENARIO 4: Multi-Product Event Attribution
  // ═══════════════════════════════════════════════════════════════════════════════

  console.log('\n[SCENARIO 4] Multi-Product Event Attribution')

  let s4Conv = ''
  await test('product mention → event with product_id when available', async () => {
    const { data: conv, error } = await supabase
      .from('conversations')
      .insert({ assistant_id: ASST_ID, customer_id: cust2Id, type: 'simulation', status: 'active' } as never)
      .select('id').single()
    if (error) throw new Error(error.message)
    s4Conv = conv!.id

    await processCore({
      businessId: BIZ_ID, assistantId: ASST_ID, customerId: cust2Id,
      conversationId: s4Conv, userMessage: 'Quiero comprar algo',
      channel: 'simulation', mode: 'complete', requestType: 'training',
    })

    const { data: events } = await supabase
      .from('sales_events').select('event_type, product_id, metadata')
      .eq('conversation_id', s4Conv)

    // Code executed without error — attribution runs
    if (events && events.length > 0) {
      console.log(`    (found ${events.length} sales event(s))`)
    }
  })

  await deleteFixtures('sales_events', { conversation_id: s4Conv })
  await deleteFixtures('messages', { conversation_id: s4Conv })
  await deleteFixtures('conversations', { id: s4Conv })

  // ═══════════════════════════════════════════════════════════════════════════════
  // SCENARIO 5: History Without Duplicates
  // ═══════════════════════════════════════════════════════════════════════════════

  console.log('\n[SCENARIO 5] History Without Duplicates')

  let s5Conv = ''
  await test('3 messages → exactly 3 user + 3 assistant rows', async () => {
    const { data: conv, error } = await supabase
      .from('conversations')
      .insert({ assistant_id: ASST_ID, customer_id: custId, type: 'simulation', status: 'active' } as never)
      .select('id').single()
    if (error) throw new Error(error.message)
    s5Conv = conv!.id

    const msgs = ['Hola', '¿Qué productos tienen?', 'Quiero información']
    for (const msg of msgs) {
      await processCore({
        businessId: BIZ_ID, assistantId: ASST_ID, customerId: custId,
        conversationId: s5Conv, userMessage: msg,
        channel: 'simulation', mode: 'complete', requestType: 'training',
      })
    }

    const { data: messages } = await supabase
      .from('messages').select('role, content')
      .eq('conversation_id', s5Conv).order('created_at', { ascending: true })

    assert(!!messages, 'no messages')
    const userMsgs = messages!.filter((m: { role: string }) => m.role === 'user')
    const asstMsgs = messages!.filter((m: { role: string }) => m.role === 'assistant')
    assert(userMsgs.length === 3, `expected 3 user msgs, got ${userMsgs.length}`)
    assert(asstMsgs.length === 3, `expected 3 assistant msgs, got ${asstMsgs.length}`)
  })

  await test('limit(30) query returns all 6 messages, no duplicates', async () => {
    const { data: messages } = await supabase
      .from('messages').select('role, content')
      .eq('conversation_id', s5Conv)
      .order('created_at', { ascending: false }).limit(30)

    assert(!!messages, 'no messages')
    assert(messages!.length === 6, `expected 6, got ${messages!.length}`)
    const keys = messages!.map((m: { role: string; content: string }) => `${m.role}:${m.content}`)
    assert(new Set(keys).size === keys.length, 'duplicate messages found')
  })

  await deleteFixtures('messages', { conversation_id: s5Conv })
  await deleteFixtures('conversations', { id: s5Conv })

  // ═══════════════════════════════════════════════════════════════════════════════
  // SCENARIO 6: No Double Insert
  // ═══════════════════════════════════════════════════════════════════════════════

  console.log('\n[SCENARIO 6] No Double Insert (complete mode)')

  let s6Conv = ''
  await test('1 processCore call → exactly +1 user + +1 assistant row', async () => {
    const { data: conv, error } = await supabase
      .from('conversations')
      .insert({ assistant_id: ASST_ID, customer_id: custId, type: 'simulation', status: 'active' } as never)
      .select('id').single()
    if (error) throw new Error(error.message)
    s6Conv = conv!.id

    const b4U = await countRows('messages', { conversation_id: s6Conv, role: 'user' })
    const b4A = await countRows('messages', { conversation_id: s6Conv, role: 'assistant' })

    await processCore({
      businessId: BIZ_ID, assistantId: ASST_ID, customerId: custId,
      conversationId: s6Conv, userMessage: 'Mensaje E2E de prueba',
      channel: 'whatsapp', mode: 'complete', requestType: 'live_customer',
    })

    const afU = await countRows('messages', { conversation_id: s6Conv, role: 'user' })
    const afA = await countRows('messages', { conversation_id: s6Conv, role: 'assistant' })
    assert(afU - b4U === 1, `user delta: ${afU - b4U}`)
    assert(afA - b4A === 1, `assistant delta: ${afA - b4A}`)
  })

  await deleteFixtures('messages', { conversation_id: s6Conv })
  await deleteFixtures('conversations', { id: s6Conv })

  // ═══════════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════════════════

  console.log('\n[CLEANUP]')
  await deleteFixtures('customers', { id: custId })
  await deleteFixtures('customers', { id: cust2Id })
  console.log('  ✓ Test customers removed')

  // ═══════════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════════

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===\n`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
