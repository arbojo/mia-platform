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

  // Precio de cada autor, por conversacion, tal cual se dijo en el texto.
  const byConv = new Map<string, { human: Set<string>; bot: Set<string> }>()
  for (const r of rows) {
    const t = flat(r.content)
    if (!/\$/.test(t)) continue
    const author = label(r)
    if (author !== 'human' && author !== 'bot') continue
    const key = r.external_customer_id ?? '?'
    const entry = byConv.get(key) ?? { human: new Set(), bot: new Set() }
    for (const p of t.match(/\$\s?([\d,]{3,7})/g) ?? []) {
      entry[author].add(p.replace(/\s/g, ''))
    }
    byConv.set(key, entry)
  }

  console.log('='.repeat(78))
  console.log('CONVERSACIONES DONDE EL PRECIO DICE DISTINTO EL VENDEDOR Y EL BOT')
  console.log('='.repeat(78))
  let conflicts = 0
  for (const [conv, { human, bot }] of byConv) {
    const shared = [...human].filter((p) => bot.has(p))
    const diffHuman = [...human].filter((p) => !bot.has(p))
    const diffBot = [...bot].filter((p) => !human.has(p))
    if (shared.length === 0 || (diffHuman.length === 0 && diffBot.length === 0)) continue
    conflicts += 1
    console.log(`   ${conv}`)
    console.log(`      coincide  : ${shared.join(' ')}`)
    console.log(`      solo Apply vendedora: ${diffHuman.join(' ') || '-'}`)
    console.log(`      solo del bot       : ${diffBot.join(' ') || '-'}`)
  }
  console.log(`\n   conversaciones con discrepancia real: ${conflicts}`)

  console.log()
  console.log('='.repeat(78))
  console.log('CADA MENSAJE QUE LA VENDEDORA DIJO UN PRECIO')
  console.log('='.repeat(78))
  for (const r of rows.filter((x) => label(x) === 'human' && /\$/.test(x.content))) {
    console.log(`   (${(r.external_customer_id ?? '').slice(-4)}) ${flat(r.content).slice(0, 160)}`)
  }

  console.log()
  console.log('='.repeat(78))
  console.log('PEDIDO ANOMALO: Diabetic patch, 36 unidades')
  console.log('='.repeat(78))
  for (const r of rows.filter((x) => /cantidad:\s*36/i.test(flat(x.content)))) {
    console.log(`   ${flat(r.content)}`)
  }
  console.log('   --- que pidio el cliente en esa conversacion ---')
  const diag = rows.filter((x) => /diabetic/i.test(flat(x.content)))
  for (const r of diag) {
    console.log(`   [${label(r).padEnd(5)}] ${flat(r.content).slice(0, 150)}`)
  }
}

main().catch((e: unknown) => {
  console.error('ERROR:', e)
  process.exit(1)
})