import { config } from 'dotenv'
import { createAdminClient } from '../src/lib/supabase/admin'

config({ path: '.env.local' })

const BUSINESS_ID = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'

interface Msg {
  content: string
  received_at: string
  metadata: Record<string, unknown> | null
}
interface Product {
  id: string
  name: string
  price: number | string | null
  is_active?: boolean
}

const flat = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Producto -> nombres alternativos que pueden aparecer en los mensajes. */
const ALIASES: Record<string, RegExp> = {
  'Clean Nails': /clean ?nails/i,
  Neurofeet: /neurofeet/i,
  'Bye Canas': /bye ?canas/i,
  Neurotin: /neurotin/i,
  'Bella Patch': /bella ?patch|bella\s*patch/i,
  Back2Fit: /back2fit|back ?2 ?fit/i,
}

async function main() {
  const admin = createAdminClient()

  const { data: msgs, error: mErr } = await admin
    .from('channel_messages')
    .select('content, received_at, metadata')
    .eq('business_id', BUSINESS_ID)
    .like('external_id', 'harvest:%')
    .order('received_at', { ascending: true })
  if (mErr) throw mErr

  const { data: products, error: pErr } = await admin
    .from('products')
    .select('id, name, price, is_active')
    .eq('business_id', BUSINESS_ID)
  if (pErr) throw pErr

  const rows = (msgs ?? []) as Msg[]
  const catalogue = (products ?? []) as Product[]

  console.log('='.repeat(78))
  console.log('CATALOGO vs PRECIOS CITADOS EN CONVERSACIONES')
  console.log('='.repeat(78))
  for (const p of catalogue) {
    const re = ALIASES[p.name]
    if (!re) {
      console.log(`   ${p.name}: sin alias conocido`)
      continue
    }
    const hits = rows.filter((m) => re.test(flat(m.content)) && /\$/.test(flat(m.content)))
    const byPrice = new Map<string, { n: number; first: string; last: string }>()
    for (const h of hits) {
      for (const raw of flat(h.content).match(/\$\s?([\d,]{3,7})/g) ?? []) {
        const v = raw.replace(/\s/g, '')
        const e = byPrice.get(v) ?? { n: 0, first: h.received_at, last: h.received_at }
        e.n += 1
        e.last = h.received_at
        byPrice.set(v, e)
      }
    }
    const cited = [...byPrice].sort((a, b) => b[1].n - a[1].n)
    console.log()
    console.log(`   ${p.name}  (catalogo: ${p.price})`)
    if (cited.length === 0) console.log('      sin precios citados')
    for (const [price, e] of cited) {
      const mismatch = String(p.price) !== price.replace('$', '')
      console.log(
        `      ${mismatch ? 'DIFIERE' : 'ok     '} ${price.padEnd(7)} ${String(e.n).padStart(3)} msgs  ${e.first.slice(0, 10)} -> ${e.last.slice(0, 10)}`
      )
    }
  }

  console.log()
  console.log('='.repeat(78))
  console.log('PRODUCTOS QUE APARECEN EN PEDIDOS Y NO ESTAN EN EL CATALOGO')
  console.log('='.repeat(78))
  const known = Object.keys(ALIASES)
  const confirmations = rows.filter((m) => /pedido:\s*/i.test(flat(m.content)))
  const orphans = new Map<string, number>()
  for (const c of confirmations) {
    const m = flat(c.content).match(/pedido:\s*([^0-9$]+?)(?=monto|cantidad|por favor|envío|$)/i)
    if (!m) continue
    const name = m[1].trim().replace(/\s+/g, ' ')
    if (known.some((k) => ALIASES[k].test(name))) continue
    orphans.set(name, (orphans.get(name) ?? 0) + 1)
  }
  if (orphans.size === 0) console.log('   ninguno')
  for (const [n, c] of orphans) console.log(`   "${n}" (${c} confirmaciones) — no existe en el catalogo`)

  console.log()
  console.log('='.repeat(78))
  console.log('CANTIDADES ENVIADAS A PEDIDO')
  console.log('='.repeat(78))
  const qtys = new Map<number, number>()
  for (const c of confirmations) {
    const q = flat(c.content).match(/cantidad:\s*(\d+)/i)
    if (q) qtys.set(Number(q[1]), (qtys.get(Number(q[1])) ?? 0) + 1)
  }
  for (const [q, n] of [...qtys].sort((a, b) => a[0] - b[0])) {
    console.log(`   cantidad ${String(q).padStart(4)} : ${n} mensajes${q === 36 ? '   <-- anomalo' : ''}`)
  }
}

main().catch((e: unknown) => {
  console.error('ERROR:', e)
  process.exit(1)
})