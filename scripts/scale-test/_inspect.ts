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
  if (!biz || biz.length === 0) { console.log('No [SCALE TEST] businesses found'); return }

  const allIds = biz.map(b => b.id)
  console.log(`${biz.length} scale test businesses found:`)
  for (const b of biz) {
    console.log(`  ${b.id} | ${b.name}`)
  }
  console.log()

  // Tables with direct business_id
  const directTables = ['ai_usage', 'learning_events', 'assistant_memory', 'knowledge_versions', 'knowledge_items', 'sales_rules', 'products', 'assistants', 'brand_identities', 'lab_sessions']
  const totals: Record<string, number> = {}

  for (const t of directTables) {
    let total = 0
    for (const id of allIds) {
      const { count, error: ce } = await s.from(t).select('*', { count: 'exact', head: true }).eq('business_id', id)
      if (ce) {
        if (ce.message.includes('does not exist')) continue
        console.log(`  ${t}: ERROR ${ce.message}`)
      } else {
        total += count ?? 0
      }
    }
    totals[t] = total
  }

  // conversations: join through assistants
  const { data: asst } = await s.from('assistants').select('id').in('business_id', allIds)
  const asstIds = (asst ?? []).map(a => a.id)
  if (asstIds.length > 0) {
    const { count: convCount, error: convErr } = await s.from('conversations').select('*', { count: 'exact', head: true }).in('assistant_id', asstIds)
    if (convErr) console.log(`  conversations: ERROR ${convErr.message}`)
    else totals['conversations'] = convCount ?? 0

    const { data: convs } = await s.from('conversations').select('id').in('assistant_id', asstIds)
    const convIds = (convs ?? []).map(c => c.id)
    if (convIds.length > 0) {
      const { count: msgCount } = await s.from('messages').select('*', { count: 'exact', head: true }).in('conversation_id', convIds)
      totals['messages'] = msgCount ?? 0
    } else {
      totals['messages'] = 0
    }

    // customers created by scale test
    const { count: custCount } = await s.from('customers').select('*', { count: 'exact', head: true }).in('assistant_id', asstIds)
    totals['customers'] = custCount ?? 0
  }

  console.log('\nRecords to delete:')
  console.log('━━━━━━━━━━━━━━━━━━')
  let grandTotal = 0
  for (const [table, count] of Object.entries(totals)) {
    if (count > 0) {
      console.log(`  ${table.padEnd(20)} ${count}`)
      grandTotal += count
    }
  }
  console.log('━━━━━━━━━━━━━━━━━━')
  console.log(`  TOTAL              ${grandTotal}`)

  // Check Vitanova
  const { count: vitCount } = await s.from('businesses').select('*', { count: 'exact', head: true }).eq('name', 'Vitanova')
  console.log(`\nVitanova businesses: ${vitCount ?? 0}`)

  // Output IDs for tracking file
  console.log(`\nBusiness IDs for tracking: ${JSON.stringify(allIds)}`)
}

main().catch(console.error)
