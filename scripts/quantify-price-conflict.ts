import { config } from 'dotenv'
import { createAdminClient } from '../src/lib/supabase/admin'

config({ path: '.env.local' })

const BUSINESS_ID = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'

interface Row {
  external_customer_id: string | null
  content: string
  metadata: Record<string, unknown> | null
}

const label = (r: Row): string =>
  typeof r.metadata?.author_label === 'string' ? r.metadata.author_label : 'customer'
const flat = (s: string) => s.replace(/\s+/g, ' ').trim()

async function main() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('channel_messages')
    .select('external_customer_id, content, metadata')
    .eq('business_id', BUSINESS_ID)
    .like('external_id', 'harvest:%')
  if (error) throw error
  const rows = (data ?? []) as Row[]

  const nail = rows.filter((r) => /clean ?nails/i.test(flat(r.content)) && /\$/.test(flat(r.content)))

  const buckets = [
    { name: 'Clean Nails a $550', test: (t: string) => t.includes('$550') },
    { name: 'Clean Nails a $499 (menu)', test: (t: string) => t.includes('$499') },
    { name: 'Clean Nails a $799 (menu, 2 piezas)', test: (t: string) => t.includes('$799') },
    { name: 'Promo "Resultados garantizados"', test: (t: string) => /resultados garantizados/i.test(t) },
  ]

  console.log(`mensajes que nombran Clean Nails con precio: ${nail.length}`)
  console.log()
  for (const b of buckets) {
    const hits = nail.filter((r) => b.test(flat(r.content)))
    const convos = new Set(hits.map((r) => r.external_customer_id))
    const autores = [...new Set(hits.map(label))]
    console.log(
      `   ${b.name.padEnd(38)} ${String(hits.length).padStart(3)} msgs · ${String(convos.size).padStart(2)} conversaciones · ${autores.join('/')}`
    )
  }

  const conflict = nail.filter((r) => {
    const t = flat(r.content)
    return (t.includes('$499') || t.includes('$799')) && t.includes('$550')
  })
  console.log()
  console.log(`mensajes que citan Clean Nails en AMBOS precios a la vez: ${conflict.length}`)
  for (const c of conflict.slice(0, 5)) {
    console.log(`   (${(c.external_customer_id ?? '').slice(-4)}) ${flat(c.content).slice(0, 220)}`)
  }

  console.log()
  const neuro = rows.filter((r) => /neurofeet/i.test(flat(r.content)) && /\$/.test(flat(r.content)))
  const packs = new Map<string, number>()
  for (const n of neuro) {
    const m = flat(n.content).match(/(\d+)\s*pares?[^.]{0,30}?\$\s?([\d,]+)/i)
    if (m) packs.set(`${m[1]} pares = ${m[2]}`, (packs.get(`${m[1]} pares = ${m[2]}`) ?? 0) + 1)
  }
  console.log('Neurofeet, presentacion de packs:')
  for (const [k, v] of packs) console.log(`   ${k}  (${v} mensajes)`)
}

main().catch((e: unknown) => {
  console.error('ERROR:', e)
  process.exit(1)
})