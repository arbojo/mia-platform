import { config } from 'dotenv'
import { createAdminClient } from '../src/lib/supabase/admin'

config({ path: '.env.local' })

const BUSINESS_ID = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'

interface Row {
  external_customer_id: string | null
  direction: 'incoming' | 'outgoing'
  content: string
  received_at: string
  metadata: Record<string, unknown> | null
}

const label = (r: Row): string =>
  typeof r.metadata?.author_label === 'string' ? r.metadata.author_label : 'customer'
const flat = (s: string) => s.replace(/\s+/g, ' ').trim()

async function main() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('channel_messages')
    .select('external_customer_id, direction, content, received_at, metadata')
    .eq('business_id', BUSINESS_ID)
    .like('external_id', 'harvest:%')
    .order('received_at', { ascending: true })
  if (error) throw error
  const rows = (data ?? []) as Row[]

  console.log('='.repeat(78))
  console.log('A) CONFIRMACIONES DE PEDIDO: producto, cantidad y monto')
  console.log('='.repeat(78))
  const confirmations = rows.filter((r) => /monto a pagar/i.test(flat(r.content)))
  for (const c of confirmations) {
    const t = flat(c.content)
    const qty = t.match(/cantidad:\s*(\d+)/i)?.[1]
    const amount = t.match(/monto a pagar[^$]*\$\s?([\d,]+)/i)?.[1]
    const product =
      t.match(/pedido:\s*([^0-9]+?)(?=monto|cantidad|por favor|$)/i)?.[1]?.trim() ?? '(desconocido)'
    console.log(
      `   [${label(c).padEnd(5)}] qty=${(qty ?? '?').padStart(3)} monto=${(amount ?? '?').padStart(6)}  ${product.slice(0, 52)}`
    )
  }

  console.log()
  console.log('='.repeat(78))
  console.log('B) PRECIO DE Clean Nails SEGUN CADA AUTOR')
  console.log('='.repeat(78))
  const nail = /clean ?nails|aparato|l[aá]ser/i
  for (const author of ['human', 'bot'] as const) {
    const hits = rows.filter(
      (r) => label(r) === author && /\$/.test(r.content) && nail.test(flat(r.content))
    )
    const prices = new Map<string, number>()
    for (const h of hits) {
      for (const p of flat(h.content).match(/\$\s?([\d,]{3,7})/g) ?? []) {
        prices.set(p.replace(/\s/g, ''), (prices.get(p.replace(/\s/g, '')) ?? 0) + 1)
      }
    }
    console.log(`   ${author.padEnd(6)} (${hits.length} msgs): ${[...prices].map(([p, n]) => `${p} x${n}`).join('  ')}`)
  }

  console.log()
  console.log('='.repeat(78))
  console.log('C) PRECIO DE Bye Canas SEGUN CADA AUTOR')
  console.log('='.repeat(78))
  const bye = /bye ?canas/i
  for (const author of ['human', 'bot'] as const) {
    const hits = rows.filter((r) => label(r) === author && /\$/.test(r.content) && bye.test(flat(r.content)))
    const prices = new Map<string, number>()
    for (const h of hits) {
      for (const p of flat(h.content).match(/\$\s?([\d,]{3,7})/g) ?? []) {
        prices.set(p.replace(/\s/g, ''), (prices.get(p.replace(/\s/g, '')) ?? 0) + 1)
      }
    }
    console.log(`   ${author.padEnd(6)} (${hits.length} msgs): ${[...prices].map(([p, n]) => `${p} x${n}`).join('  ')}`)
  }

  console.log()
  console.log('='.repeat(78))
  console.log('D) CANTIDADES ENVIADAS AL PEDIDO')
  console.log('='.repeat(78))
  const qtyDist = new Map<number, number>()
  for (const c of confirmations) {
    const qtyMatch = flat(c.content).match(/cantidad:\s*(\d+)/i)
    const q = Number(qtyMatch?.[1] ?? 'NaN')
    if (!Number.isNaN(q)) qtyDist.set(q, (qtyDist.get(q) ?? 0) + 1)
  }
  for (const [q, n] of [...qtyDist].sort((a, b) => a[0] - b[0])) {
    console.log(`   cantidad ${String(q).padStart(4)} : ${n} mensajes`)
  }
}

main().catch((e: unknown) => {
  console.error('ERROR:', e)
  process.exit(1)
})