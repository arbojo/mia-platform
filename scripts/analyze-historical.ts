import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { generateObject } from 'ai'
import { z } from 'zod'
import { getProviderModel } from '../src/lib/ai/task-routing'
import { writeFileSync } from 'node:fs'
import path from 'node:path'

config({ path: '.env.local' })

const BUSINESS_ID = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'
// MIA deja de intervenir en conversaciones el 28 de septiembre.
// Desde el 29 la atencion es humana: shadow + vendedora, no son conversaciones de MIA.
const FROM = '2026-08-01'
const TO = '2026-09-29'
const EvaluationSchema = z.object({
  score: z.number().min(1).max(10),
  criteria: z.object({
    product_knowledge: z.number().min(1).max(10),
    empathy: z.number().min(1).max(10),
    objection_handling: z.number().min(1).max(10),
    closing: z.number().min(1).max(10),
    rule_following: z.number().min(1).max(10),
  }),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  suggestions: z.array(z.string()),
})

interface Row {
  id: string
  customer_id: string | null
  external_customer_id: string | null
  direction: 'incoming' | 'outgoing'
  content: string
  metadata: Record<string, unknown> | null
  received_at: string | null
  created_at: string
}

function ts(r: Row) { return new Date(r.received_at ?? r.created_at).getTime() }
function buildThreads(rows: Row[]): Row[][] {
  const GAP = 6 * 3600 * 1000
  const m = new Map<string, Row[]>()
  for (const r of rows) {
    const k = r.customer_id ?? r.external_customer_id ?? 'x'
    const l = m.get(k) ?? []; l.push(r); m.set(k, l)
  }
  const out: Row[][] = []
  for (const l of m.values()) {
    l.sort((a, b) => ts(a) - ts(b))
    let cur: Row[] = []; let prev = 0
    for (const r of l) {
      const t = ts(r)
      if (cur.length && t - prev > GAP) { out.push(cur); cur = [] }
      cur.push(r); prev = t
    }
    if (cur.length) out.push(cur)
  }
  return out
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: biz } = await supabase.from('businesses').select('name').eq('id', BUSINESS_ID).single()
  const bizName = biz?.name ?? 'Desconocido'

  const { data, error } = await supabase
    .from('channel_messages')
    .select('id, customer_id, external_customer_id, direction, content, metadata, received_at, created_at')
    .eq('business_id', BUSINESS_ID)
    .gte('created_at', FROM)
    .lt('created_at', TO)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)

  // Los mensajes de la vendedora humana llegan como `incoming` (los escribe desde
  // el mismo numero del negocio). Se excluyen por autor, no por direccion.
  const rows = (data ?? []).filter((r) => (r.metadata?.author as string) !== 'human') as Row[]
  const threads = buildThreads(rows).filter(
    (t) => t.some((r) => r.direction === 'incoming') && t.some((r) => r.direction === 'outgoing')
  )

  const { model, modelName } = getProviderModel('analysis')
  const results: any[] = []
  for (const [i, t] of threads.entries()) {
    const text = t.map((m) => `${m.direction === 'incoming' ? 'Cliente' : 'MIA'}: ${m.content}`).join('\n\n')
    try {
      const { object } = await generateObject({
        model, schema: EvaluationSchema,
        prompt: `Evalúa esta conversación de ventas entre un cliente y MIA, una asistente de ventas.

Negocio: ${bizName}
MIA es una asistente de ventas que debe conocer los productos, respetar las reglas del negocio y ser empática con los clientes.

Conversación:
${text}

Califica del 1 al 10 en cada criterio:
- product_knowledge: ¿MIA conoce bien los productos?
- empathy: ¿MIA es empática y cercana?
- objection_handling: ¿Maneja objeciones correctamente?
- closing: ¿Intenta cerrar la venta?
- rule_following: ¿Respeta las reglas del negocio?

Identifica fortalezas, debilidades y sugerencias concretas de mejora.`,
      })
      results.push({ ...object, idx: i + 1, turns: t.length, at: String(t[0].received_at ?? t[0].created_at), transcript: text })
      console.log(`[${i + 1}/${threads.length}] ${object.score}`)
    } catch (e) {
      console.log(`[${i + 1}] ERR ${(e as Error).message.slice(0, 80)}`)
    }
  }

  writeFileSync(path.resolve('docs/analysis/historical-evaluations.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), model: modelName, window: { from: FROM, to: TO }, total: results.length, evaluations: results }, null, 2))

  // Agregados
  const crit = ['product_knowledge', 'empathy', 'objection_handling', 'closing', 'rule_following'] as const
  const avg = (f: (r: any) => number) => (results.reduce((s, r) => s + f(r), 0) / results.length).toFixed(2)
  console.log('\n=== MEDIAS (n=' + results.length + ') ===')
  console.log('score global:', avg((r) => r.score))
  for (const c of crit) console.log(`${c}: ${avg((r) => r.criteria[c])}`)

  const dist: Record<string, number> = {}
  for (const r of results) { const b = Math.floor(r.score); dist[b] = (dist[b] ?? 0) + 1 }
  console.log('\n=== DISTRIBUCION ===')
  for (const k of Object.keys(dist).sort()) console.log(`score ${k}: ${dist[k]}`)

  const weak: Record<string, number> = {}
  for (const r of results) for (const w of r.weaknesses) {
    const key = w.toLowerCase().slice(0, 60)
    weak[key] = (weak[key] ?? 0) + 1
  }
  console.log('\n=== DEBILIDADES MAS FRECUENTES ===')
  Object.entries(weak).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([k, n]) => console.log(`${n}x  ${k}`))

  console.log('\n=== HILOS CON SCORE <= 5 ===')
  for (const r of results.filter((x) => x.score <= 5).sort((a, b) => a.score - b.score)) {
    console.log(`\n#${r.idx} score=${r.score} ${r.at.slice(0, 16)} (${r.turns} msgs)`)
    console.log(`  criterio: ${JSON.stringify(r.criteria)}`)
    r.weaknesses.forEach((w: string) => console.log(`  - ${w}`))
  }
}

main().catch((e) => { console.error(e); process.exit(1) })