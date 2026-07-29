import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  const { data: biz, error } = await s.from('businesses').select('id, name').like('name', '[SCALE TEST]%')
  if (error) { console.error('Query error:', error.message); return }

  if (!biz || biz.length === 0) {
    console.log('No [SCALE TEST] businesses found')
    return
  }

  for (const b of biz) {
    console.log(`Business: ${b.id} | ${b.name}`)
    const tables = ['ai_usage', 'learning_events', 'assistant_memory', 'messages', 'conversations', 'knowledge_versions', 'knowledge_items', 'sales_rules', 'products', 'assistants', 'brand_identities', 'lab_sessions']
    for (const t of tables) {
      const { count, error: ce } = await s.from(t).select('*', { count: 'exact', head: true }).eq('business_id', b.id)
      if (ce) {
        if (ce.message.includes('does not exist')) continue
        console.log(`  ${t}: ERROR ${ce.message}`)
      } else {
        console.log(`  ${t}: ${count ?? 0}`)
      }
    }
    console.log('---')
  }

  // Count Vitanova businesses to verify they're untouched
  const { count: vitCount } = await s.from('businesses').select('*', { count: 'exact', head: true }).eq('name', 'Vitanova')
  console.log(`Vitanova businesses: ${vitCount ?? 0}`)
}

main().catch(console.error)
