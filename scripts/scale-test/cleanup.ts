import { config } from 'dotenv'
config({ path: '.env.local' })
import * as fs from 'fs'
import * as path from 'path'
import { getSupabase } from './utils'

function findTrackingFiles(): string[] {
  const dir = __dirname
  const files = fs.readdirSync(dir)
  return files.filter((f) => f.startsWith('.test-run-') && f.endsWith('.json')).map((f) => path.join(dir, f))
}

function parseTrackingFile(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const data = JSON.parse(content)
  return data.businessIds ?? []
}

async function getAssistantIds(supabase: ReturnType<typeof getSupabase>, bizIds: string[]): Promise<string[]> {
  const { data } = await supabase.from('assistants').select('id').in('business_id', bizIds)
  return (data ?? []).map((a: { id: string }) => a.id)
}

async function getConversationIds(supabase: ReturnType<typeof getSupabase>, asstIds: string[]): Promise<string[]> {
  const { data } = await supabase.from('conversations').select('id').in('assistant_id', asstIds)
  return (data ?? []).map((c: { id: string }) => c.id)
}

async function deleteInChunks(supabase: ReturnType<typeof getSupabase>, table: string, column: string, ids: string[]): Promise<number> {
  let total = 0
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    const { error, count } = await supabase.from(table).delete({ count: 'exact' }).in(column, chunk)
    if (error) {
      if (!error.message.includes('does not exist')) {
        console.log(`  Warning ${table}.${column}: ${error.message}`)
      }
    } else {
      total += count ?? 0
    }
  }
  return total
}

async function deleteAll(supabase: ReturnType<typeof getSupabase>, table: string, column: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  return deleteInChunks(supabase, table, column, ids)
}

async function cleanup() {
  console.log('MIA Scale Test — Cleanup')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // Collect business IDs from tracking files
  const trackingFiles = findTrackingFiles()
  let allIds: string[] = []

  for (const f of trackingFiles) {
    const ids = parseTrackingFile(f)
    if (ids.length > 0) allIds = allIds.concat(ids)
    console.log(`  ${path.basename(f)}: ${ids.length} IDs`)
  }

  // If tracking files are empty, find by name prefix
  if (allIds.length === 0) {
    console.log('  No IDs in tracking files — querying by [SCALE TEST] prefix...')
    const supabase = getSupabase()
    const { data: biz } = await supabase.from('businesses').select('id').like('name', '[SCALE TEST]%')
    allIds = (biz ?? []).map((b: { id: string }) => b.id)
    console.log(`  Found ${allIds.length} businesses by prefix`)
  }

  if (allIds.length === 0) {
    console.log('No scale test businesses found. Nothing to clean up.')
    process.exit(0)
  }

  console.log(`\nBusiness IDs to clean: ${allIds.length}`)

  const skipConfirm = process.argv.includes('--yes')
  if (!skipConfirm) {
    console.log(`Type "CLEAN" to permanently delete ${allIds.length} businesses and all related data:`)
    const answer = await new Promise<string>((resolve) => {
      process.stdin.once('data', (data) => resolve(data.toString().trim()))
    })
    if (answer !== 'CLEAN') {
      console.log('Cancelled.')
      process.exit(0)
    }
  }

  const supabase = getSupabase()
  const startTime = Date.now()
  const deleted: Record<string, number> = {}

  // Resolve FK chain
  const asstIds = await getAssistantIds(supabase, allIds)
  console.log(`\n  Resolved ${asstIds.length} assistants`)
  const convIds = await getConversationIds(supabase, asstIds)
  console.log(`  Resolved ${convIds.length} conversations`)

  // Delete in FK-safe order
  if (convIds.length > 0) {
    deleted['messages'] = await deleteAll(supabase, 'messages', 'conversation_id', convIds)
    deleted['conversations'] = await deleteAll(supabase, 'conversations', 'id', convIds)
  }
  if (asstIds.length > 0) {
    deleted['customers'] = await deleteAll(supabase, 'customers', 'assistant_id', asstIds)
  }
  deleted['lab_sessions'] = await deleteAll(supabase, 'lab_sessions', 'business_id', allIds)
  deleted['learning_events'] = await deleteAll(supabase, 'learning_events', 'business_id', allIds)
  deleted['assistant_memory'] = await deleteAll(supabase, 'assistant_memory', 'business_id', allIds)
  deleted['knowledge_versions'] = await deleteAll(supabase, 'knowledge_versions', 'business_id', allIds)
  deleted['knowledge_items'] = await deleteAll(supabase, 'knowledge_items', 'business_id', allIds)
  deleted['sales_rules'] = await deleteAll(supabase, 'sales_rules', 'business_id', allIds)
  deleted['ai_instructions'] = await deleteAll(supabase, 'ai_instructions', 'business_id', allIds)
  deleted['products'] = await deleteAll(supabase, 'products', 'business_id', allIds)
  deleted['assistants'] = await deleteAll(supabase, 'assistants', 'business_id', allIds)
  deleted['brand_identities'] = await deleteAll(supabase, 'brand_identities', 'business_id', allIds)
  deleted['businesses'] = await deleteAll(supabase, 'businesses', 'id', allIds)

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  // Report
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  CLEANUP REPORT')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Execution time: ${elapsed}s`)
  console.log('')
  let totalDeleted = 0
  for (const [table, count] of Object.entries(deleted)) {
    console.log(`  ${table.padEnd(22)} ${count} records`)
    totalDeleted += count
  }
  console.log('  ─────────────────────────────')
  console.log(`  TOTAL                ${totalDeleted} records`)

  // Clean up tracking files
  let trackDeleted = 0
  for (const f of trackingFiles) {
    try { fs.unlinkSync(f); trackDeleted++ } catch { /* ok */ }
  }
  console.log(`  Tracking files removed: ${trackDeleted}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // Validation
  console.log('VALIDATION:')
  const { data: remaining } = await supabase.from('businesses').select('id, name').like('name', '[SCALE TEST]%')
  const remainingBiz = remaining ?? []
  console.log(`  [SCALE TEST] businesses remaining: ${remainingBiz.length} ${remainingBiz.length > 0 ? '✗ FAIL' : '✓ PASS'}`)
  if (remainingBiz.length > 0) {
    for (const b of remainingBiz) console.log(`    ${b.id} ${b.name}`)
  }

  const { count: vitCount } = await supabase.from('businesses').select('*', { count: 'exact', head: true }).eq('name', 'Vitanova')
  console.log(`  Vitanova exists: ${vitCount ?? 0} ${(vitCount ?? 0) > 0 ? '✓ PASS' : '✗ FAIL'}`)

  console.log('\nCleanup complete.')
  process.exit(0)
}

cleanup()