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

  const wanted = ['$499', '$799', '$550', '$399']
  for (const price of wanted) {
    const hits = rows.filter((r) => flat(r.content).includes(price))
    const convos = new Set(hits.map((r) => r.external_customer_id))
    console.log('='.repeat(78))
    console.log(
      `${price}: ${hits.length} mensajes · ${convos.size} conversaciones · autores: ${[...new Set(hits.map(label))].join(', ')}`
    )
    console.log('='.repeat(78))
    const seen = new Set<string>()
    for (const h of hits) {
      const t = flat(h.content)
      const key = t.slice(0, 70)
      if (seen.has(key)) continue
      seen.add(key)
      if (seen.size > 6) break
      console.log(`   [${label(h).padEnd(5)}] (${(h.external_customer_id ?? '').slice(-4)}) ${t.slice(0, 230)}`)
    }
    console.log()
  }

  console.log('='.repeat(78))
  console.log('MENSAJES QUE NOMBRAN Clean Nails CON PRECIO')
  console.log('='.repeat(78))
  for (const r of rows.filter((x) => /clean ?nails/i.test(flat(x.content)) && /\$/.test(flat(x.content)))) {
    const t = flat(r.content)
    console.log(`   [${label(r).padEnd(5)}] ${t.slice(0, 200)}`)
  }
}

main().catch((e: unknown) => {
  console.error('ERROR:', e)
  process.exit(1)
})