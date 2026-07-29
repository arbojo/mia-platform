import { config } from 'dotenv'
config({ path: '.env.local' })
import * as fs from 'fs'
import * as path from 'path'
import { getSupabase } from './utils'
import { TEST_BUSINESS_NAME } from './config'

async function main() {
  console.log('MIA Adversarial Knowledge Test — Cleanup\n')

  const supabase = getSupabase()
  const { data: biz } = await supabase.from('businesses').select('id').like('name', `${TEST_BUSINESS_NAME}%`)
  const ids = (biz ?? []).map(b => b.id)

  if (ids.length === 0) {
    console.log('No test businesses found.')
    process.exit(0)
  }

  console.log(`Found ${ids.length} test business(es): ${ids.join(', ')}`)

  const skipConfirm = process.argv.includes('--yes')
  if (!skipConfirm) {
    console.log('Type "CLEAN" to permanently delete all test data:')
    const answer = await new Promise<string>((resolve) => { process.stdin.once('data', (data) => resolve(data.toString().trim())) })
    if (answer !== 'CLEAN') { console.log('Cancelled.'); process.exit(0) }
  }

  const start = Date.now()
  const deleted: Record<string, number> = {}

  // Get assistant IDs
  const { data: asst } = await supabase.from('assistants').select('id').in('business_id', ids)
  const asstIds = (asst ?? []).map(a => a.id)

  // Get conversation IDs
  const { data: convs } = await supabase.from('conversations').select('id').in('assistant_id', asstIds)
  const convIds = (convs ?? []).map(c => c.id)

  // Delete in FK order
  if (convIds.length > 0) {
    const { count: msgDel } = await supabase.from('messages').delete({ count: 'exact' }).in('conversation_id', convIds)
    deleted['messages'] = msgDel ?? 0
    const { count: convDel } = await supabase.from('conversations').delete({ count: 'exact' }).in('id', convIds)
    deleted['conversations'] = convDel ?? 0
  }

  for (const t of ['learning_events', 'knowledge_versions', 'business_memory', 'knowledge_items', 'sales_rules', 'ai_instructions', 'products', 'assistants', 'brand_identities']) {
    const { count, error } = await supabase.from(t).delete({ count: 'exact' }).in('business_id', ids)
    if (error) { if (!error.message.includes('does not exist')) console.log(`  ${t}: ${error.message}`) }
    else deleted[t] = count ?? 0
  }

  const { count: bizDel } = await supabase.from('businesses').delete({ count: 'exact' }).in('id', ids)
  deleted['businesses'] = bizDel ?? 0

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  let total = 0

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  CLEANUP REPORT')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Time: ${elapsed}s`)
  for (const [table, count] of Object.entries(deleted)) {
    if (count > 0) { console.log(`  ${table.padEnd(22)} ${count}`); total += count }
  }
  console.log(`  ─────────────────────────────`)
  console.log(`  TOTAL                 ${total}`)

  // Clean tracking files
  const dir = __dirname
  const files = fs.readdirSync(dir).filter(f => f.startsWith('.adversarial-') && f.endsWith('.json'))
  for (const f of files) { try { fs.unlinkSync(path.join(dir, f)) } catch { /* ok */ } }
  console.log(`  Tracking files: ${files.length} removed`)

  // Validate
  const { data: rem } = await supabase.from('businesses').select('id').like('name', `${TEST_BUSINESS_NAME}%`)
  console.log(`\nValidation: ${(rem ?? []).length === 0 ? '✓ All test data removed' : '✗ Some data remains'}`)

  console.log('\nDone.')
  process.exit(0)
}

main().catch(console.error)
