import { config } from 'dotenv'
config({ path: '.env.local' })
import { createAdminClient } from '@/lib/supabase/admin'
import { detectIntent } from '@/lib/runtime/intents'
import { hasSalesTrigger } from '@/lib/sales/detect'
import { triggerMatches, intentMatchesTrigger } from '@/lib/runtime/media'

const RUN_AI = process.argv.includes('--ai')

function banner(title: string) {
  console.log(`\n━━━ ${title} ━━━`)
}

interface Case {
  label: string
  input: string
  expected: boolean | string | null
}

function checkPartA() {
  banner('PARTE A · Falsos positivos en gatillos de intención (lógica pura, sin tokens)')

  const triggerCases: Case[] = [
    { label: 'Negación de "quiero"', input: 'no quiero saber más, gracias', expected: false },
    { label: 'Negación de compra', input: 'ya no quiero nada por hoy', expected: false },
    { label: 'Reconocimiento sin compra', input: 'listo, muchas gracias por la información', expected: false },
    { label: 'Homógrafo "cara" (rostro)', input: 'se me puso la cara roja de vergüenza', expected: false },
    { label: '"mi número" no telefónico', input: 'mi número favorito es el 7', expected: false },
    { label: 'Compra genérica como sustantivo', input: '¿tiene garantía de compra?', expected: true },
    { label: 'Confirmación explícita', input: 'sí, dámelo, confirmo el pedido', expected: true },
    { label: 'Rechazo explícito', input: 'no me interesa, no gracias', expected: true },
    { label: 'Duda de precio', input: '¿cuánto cuesta?', expected: true },
  ]

  const intentCases: Case[] = [
    { label: 'Cliente va a enviar algo (envío=verbo) → sin intención', input: 'te envío la dirección para que la anotes', expected: null },
    { label: 'Valor agregado ≠ precio', input: '¿qué valor agregado tiene?', expected: null },
    { label: 'Pago de cuentas ≠ compra', input: 'pago mis cuentas en línea', expected: null },
    { label: 'Zona geográfica ≠ envío', input: 'vivo en zona norte', expected: null },
    { label: 'Intención real de precio', input: '¿cuánto cuesta la bota?', expected: 'price' },
    { label: 'Intención real de catálogo', input: '¿qué productos tienen?', expected: 'catalog' },
    { label: 'Saludo', input: 'hola, buenas tardes', expected: 'greeting' },
    { label: 'Sin intención detectable', input: '¿a qué hora cierran?', expected: null },
  ]

  const mediaCases: Array<{ label: string; message: string; trigger: string; intent: string | null; expected: boolean }> = [
    { label: 'Trigger "precio" vs "¿cuánto cuesta?"', message: '¿cuánto cuesta?', trigger: 'precio', intent: 'price', expected: false },
    { label: 'Trigger "precio" vs palabra literal', message: 'el precio es importante', trigger: 'precio', intent: null, expected: true },
    { label: 'Trigger "intent price" vs intención', message: '¿cuánto cuesta?', trigger: 'intent price', intent: 'price', expected: true },
    { label: 'Trigger "al mencionar envío" (estilo UI)', message: '¿hacen envíos a mi ciudad?', trigger: 'al mencionar envío', intent: 'shipping', expected: true },
    { label: 'Trigger "envio" palabra literal', message: '¿hacen envíos?', trigger: 'envio', intent: null, expected: true },
    { label: 'Trigger multi-término por coma', message: '¿cuál es el precio?', trigger: 'envio, precio', intent: null, expected: true },
  ]

  const fpTrigger = triggerCases.filter((c) => c.expected === false && hasSalesTrigger(c.input)).length
  const fpIntent = intentCases.filter((c) => c.expected === null && detectIntent(c.input) !== null).length

  for (const c of triggerCases) {
    const got = hasSalesTrigger(c.input)
    const ok = got === c.expected
    console.log(`  ${ok ? 'PASS' : 'FALLA'}  hasSalesTrigger(${JSON.stringify(c.input)}) = ${got}  (esperado ${c.expected})`)
  }
  for (const c of intentCases) {
    const got = detectIntent(c.input)
    const ok = got === c.expected
    console.log(`  ${ok ? 'PASS' : 'FALLA'}  detectIntent(${JSON.stringify(c.input)}) = ${JSON.stringify(got)}  (esperado ${JSON.stringify(c.expected)})`)
  }
  for (const c of mediaCases) {
    const byMessage = triggerMatches(c.message, c.trigger)
    const byIntent = c.intent ? intentMatchesTrigger(c.intent, c.trigger) : false
    const got = byMessage || byIntent
    const ok = got === c.expected
    console.log(`  ${ok ? 'PASS' : 'FALLA'}  media(${JSON.stringify(c.trigger)}) vs ${JSON.stringify(c.message)} → ${got}  (esperado ${c.expected})`)
  }

  console.log(`\n  Resumen: ${fpTrigger} gatillos espurios de venta (disparan llamada OpenAI innecesaria); ${fpIntent} intenciones espurias.`)
}

async function probeDatabase() {
  banner('PARTE A2 · Trazabilidad de datos (probe read-only)')
  const supabase = createAdminClient()

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name')
    .order('created_at', { ascending: true })
    .limit(3)

  const target = business?.[0]
  if (!target) {
    console.log('  No hay businesses en la base. Se usarán IDs dummy para la simulación AI.')
    return { businessId: '00000000-0000-0000-0000-000000000001', assistantId: '00000000-0000-0000-0000-000000000002' }
  }

  const { data: assistant } = await supabase
    .from('assistants')
    .select('id, name')
    .eq('business_id', target.id)
    .limit(1)

  const assistantId = assistant?.[0]?.id ?? '00000000-0000-0000-0000-000000000002'

  const { count: convCount } = await supabase
    .from('conversations').select('*', { count: 'exact', head: true }).eq('business_id', target.id)
  const { count: msgCount } = await supabase
    .from('messages').select('*', { count: 'exact', head: true }).eq('business_id', target.id)
  const { count: evtCount } = await supabase
    .from('sales_events').select('*', { count: 'exact', head: true }).eq('business_id', target.id)
  const { count: sigCount } = await supabase
    .from('mia_signals').select('*', { count: 'exact', head: true }).eq('business_id', target.id)

  console.log(`  Business: ${target.name} (${target.id})`)
  console.log(`  Assistant: ${assistant?.[0]?.name ?? '(ninguno)'} (${assistantId})`)
  console.log(`  conversations: ${convCount} · messages: ${msgCount} · sales_events: ${evtCount} · mia_signals: ${sigCount}`)

  return { businessId: target.id, assistantId }
}

async function runAI(ids: { businessId: string; assistantId: string }) {
  const { detectSaleOutcome } = await import('@/lib/sales/detect')

  banner('PARTE B · Detección de cierre con IA real (gpt-4o-mini, temp 0)')

  const scenarios: Array<{ label: string; expectSale: boolean; messages: Array<{ role: string; content: string }> }> = [
    {
      label: 'S1 · Dolor/consultas sin confirmación',
      expectSale: false,
      messages: [
        { role: 'assistant', content: 'Hola, ¿en qué te ayudo hoy?' },
        { role: 'user', content: 'Hola, quería saber si tienen algo para las rodillas, me duelen bastante al subir escaleras.' },
        { role: 'assistant', content: 'Claro, contamos con una rodillera con soporte que ayuda a aliviar la molestia al caminar y subir escaleras. ¿Quieres que te cuente más?' },
        { role: 'user', content: '¿Y dura mucho? ¿Es cómoda para usarla todo el día?' },
        { role: 'assistant', content: 'Sí, está pensada para uso diario y es discreta bajo la ropa.' },
        { role: 'user', content: 'Interesante, ¿cuánto cuesta y hacen envíos?' },
      ],
    },
    {
      label: 'S2 · Negación (gatillo "quiero" sin compra)',
      expectSale: false,
      messages: [
        { role: 'assistant', content: '¿Te interesa el producto?' },
        { role: 'user', content: 'no quiero nada, solo estaba mirando' },
      ],
    },
    {
      label: 'S3 · Confirmación explícita',
      expectSale: true,
      messages: [
        { role: 'assistant', content: '¿Te dejo tu pedido listo?' },
        { role: 'user', content: 'sí, dámelo, confirmo el pedido de la rodillera' },
        { role: 'assistant', content: 'Perfecto, ¿me confirmas tu nombre y dirección?' },
        { role: 'user', content: 'Me llamo Juan Pérez, vivo en Zapopan, mi dirección es Av. López Mateos 100' },
      ],
    },
    {
      label: 'S4 · Interés con titubeo',
      expectSale: false,
      messages: [
        { role: 'assistant', content: '¿Te lo dejo apartado?' },
        { role: 'user', content: 'me interesa pero necesito pensarlo y consultarlo con mi pareja' },
      ],
    },
  ]

  for (const s of scenarios) {
    const start = Date.now()
    try {
      const result = await detectSaleOutcome({
        businessId: ids.businessId,
        assistantId: ids.assistantId,
        messages: s.messages,
      })
      const ms = Date.now() - start
      const sold = result.outcome === 'sold'
      const won = result.events.some((e) => e.type === 'SALE_WON')
      const ok = sold === s.expectSale && won === s.expectSale
      console.log(`  ${ok ? 'PASS' : 'FALLA'}  ${s.label}`)
      console.log(`       outcome=${result.outcome} · events=${JSON.stringify(result.events.map((e) => e.type))}`)
      console.log(`       datos capturados: nombre=${result.customerName ?? '-'} · tel=${result.phone ?? '-'} · ciudad=${result.city ?? '-'} · dir=${result.address ?? '-'}`)
      console.log(`       ${ms}ms`)
    } catch (err) {
      console.log(`  ERROR  ${s.label}: ${err instanceof Error ? err.message : err}`)
    }
  }
}

async function main() {
  console.log('MIA · Auditoría de fiabilidad conversacional')
  console.log('============================================')
  checkPartA()
  const ids = await probeDatabase()
  if (RUN_AI) {
    await runAI(ids)
  } else {
    console.log('\n(Parte B omitida. Ejecuta con --ai para las simulaciones con OpenAI)')
  }
  console.log('\nFin del audit.')
}

main().catch((err) => {
  console.error('Audit falló:', err)
  process.exit(1)
})
