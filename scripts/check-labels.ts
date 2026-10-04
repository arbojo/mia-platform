import { config } from 'dotenv'
import { createAdminClient } from '../src/lib/supabase/admin'

config({ path: '.env.local' })

const BUSINESS_ID = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'

const norm = (t: string) => t.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim()

async function main() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('channel_messages')
    .select('content, metadata, external_customer_id')
    .eq('business_id', BUSINESS_ID)
    .like('external_id', 'harvest:%')
    .eq('direction', 'outgoing')
  if (error) throw error

  const counts = new Map<string, number>()
  for (const r of data ?? []) {
    const label = String((r.metadata as Record<string, unknown>)?.author_label ?? '(null)')
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  console.log('distribucion actual de author_label (salientes):')
  for (const [k, v] of [...counts].sort((a, b) => b[1] - a[1])) console.log(`   ${k.padEnd(10)} ${v}`)
  console.log()

  console.log('mensajes que aun contienen asterisco markdown:')
  for (const r of data ?? []) {
    const c = norm(String(r.content))
    const label = String((r.metadata as Record<string, unknown>)?.author_label ?? '(null)')
    if (c.includes('*') && label === 'human') {
      console.log(`   [${label}] ${c.slice(0, 95).replace(/\n/g, ' ')}`)
    }
  }
}

main().catch((e: unknown) => {
  console.error('ERROR:', e)
  process.exit(1)
})