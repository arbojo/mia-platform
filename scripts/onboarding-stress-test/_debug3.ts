import { config } from 'dotenv'
config({ path: '.env.local' })
import { getSupabase } from './utils'

async function main() {
  const s = getSupabase()
  const { data: biz } = await s.from('businesses').select('id').like('name', '[STRESS TEST]%').limit(1).single()
  if (!biz) { console.error('No test business found'); return }
  console.log('Business:', biz.id)

  // Try inserting a knowledge item directly
  const { data: ki, error: kiErr } = await s.from('knowledge_items').insert({
    business_id: biz.id,
    category: 'procedure',
    question: 'Test question?',
    answer: 'Test answer.',
    source: 'import',
    confidence: 'high',
    is_active: true,
  }).select()
  if (kiErr) console.error('KI error:', kiErr.message, kiErr.details, kiErr.hint)
  else console.log('KI inserted:', ki)

  // Try inserting a sales rule directly
  const { data: sr, error: srErr } = await s.from('sales_rules').insert({
    business_id: biz.id,
    category: 'policy',
    content: 'Test policy content.',
    priority: 5,
    is_active: true,
  }).select()
  if (srErr) console.error('SR error:', srErr.message, srErr.details, srErr.hint)
  else console.log('SR inserted:', sr)

  // Try inserting an instruction directly
  const { data: ai, error: aiErr } = await s.from('ai_instructions').insert({
    business_id: biz.id,
    instruction: 'Test instruction.',
    priority: 5,
    source: 'import',
    is_active: true,
  }).select()
  if (aiErr) console.error('AI error:', aiErr.message, aiErr.details, aiErr.hint)
  else console.log('AI inserted:', ai)

  // Check existing counts
  for (const t of ['products', 'knowledge_items', 'sales_rules', 'ai_instructions', 'business_memory']) {
    const { count } = await s.from(t).select('*', { count: 'exact', head: true }).eq('business_id', biz.id)
    console.log(`${t}: ${count}`)
  }
}

main().catch(console.error)
