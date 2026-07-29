import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  const { data: businesses } = await supabase.from('businesses').select('id, name, onboarding_status')
  console.log('=== BUSINESSES ===')
  if (!businesses?.length) { console.log('No businesses found.'); return }
  businesses.forEach(b => console.log(`  ${b.id.slice(0, 8)}..  ${b.name.padEnd(20)} ${b.onboarding_status}`))

  const bid = businesses[0].id
  console.log(`\nUsing business: ${bid.slice(0, 8)}..\n`)

  // Brand Identity
  const { data: brand } = await supabase.from('brand_identities').select('*').eq('business_id', bid).maybeSingle()
  console.log('=== BRAND IDENTITY ===')
  if (brand) console.log(`  Name: ${brand.business_name}\n  Tagline: ${brand.tagline}\n  Tone: ${brand.tone_of_voice}\n  Target: ${brand.target_customers}\n  Diff: ${brand.differentiators}`)
  else console.log('  None')

  // Products
  const { data: products } = await supabase.from('products').select('id, name, price, description, benefits').eq('business_id', bid).eq('is_active', true)
  console.log(`\n=== PRODUCTS (${products?.length ?? 0}) ===`)
  products?.forEach(p => console.log(`  ${p.name}: $${p.price} | desc:${(p.description?.length ?? 0) > 0} benefits:${(p.benefits?.length ?? 0) > 0}`))

  // Sales Rules
  const { data: rules } = await supabase.from('sales_rules').select('id, category, content, priority').eq('business_id', bid).eq('is_active', true)
  console.log(`\n=== SALES RULES (${rules?.length ?? 0}) ===`)
  rules?.forEach(r => console.log(`  [${r.category}] ${r.content.slice(0, 80)}`))

  // Knowledge Items
  const { data: knowledge } = await supabase.from('knowledge_items').select('id, category, question, answer, confidence, source').eq('business_id', bid).eq('is_active', true)
  console.log(`\n=== KNOWLEDGE ITEMS (${knowledge?.length ?? 0}) ===`)
  knowledge?.forEach(k => console.log(`  [${k.category}] ${k.question.slice(0, 60)} | conf:${k.confidence} src:${k.source}`))

  // Instructions
  const { data: instructions } = await supabase.from('ai_instructions').select('id, instruction, priority, source').eq('business_id', bid).eq('is_active', true)
  console.log(`\n=== AI INSTRUCTIONS (${instructions?.length ?? 0}) ===`)
  instructions?.forEach(i => console.log(`  prio:${i.priority} src:${i.source} ${i.instruction.slice(0, 80)}`))

  // Assistant
  const { data: assistants } = await supabase.from('assistants').select('id, name, personality, communication_style').eq('business_id', bid).eq('is_active', true)
  console.log(`\n=== ASSISTANTS (${assistants?.length ?? 0}) ===`)
  assistants?.forEach(a => console.log(`  ${a.name} style:${a.communication_style} personality:${JSON.stringify(a.personality)}`))

  // Business Memory
  const { data: memory } = await supabase.from('business_memory').select('*').eq('business_id', bid).eq('is_active', true).order('observation_count', { ascending: false }).limit(20)
  console.log(`\n=== BUSINESS MEMORY (${memory?.length ?? 0}) ===`)
  memory?.forEach(m => console.log(`  ${m.memory_type.padEnd(10)} ${(m.category ?? '-').padEnd(18)} conf:${String(m.confidence).padEnd(3)} obs:${String(m.observation_count).padEnd(3)} ${m.content.slice(0, 60)}`))

  // Learning Events
  const { data: events } = await supabase.from('learning_events').select('id, correction_type, severity, category, status, original_response, corrected_response, created_at').eq('business_id', bid).order('created_at', { ascending: false }).limit(15)
  console.log(`\n=== LEARNING EVENTS (${events?.length ?? 0}) ===`)
  events?.forEach(e => console.log(`  ${(e.correction_type ?? '?').padEnd(18)} sev:${(e.severity ?? '-').padEnd(8)} ${e.status.padEnd(10)} ${e.created_at.slice(0, 10)} ${(e.original_response ?? '').slice(0, 50)}`))

  // Readiness
  const { data: readiness } = await supabase.from('readiness_snapshots').select('*').eq('business_id', bid).order('calculated_at', { ascending: false }).limit(5)
  console.log(`\n=== READINESS SNAPSHOTS (${readiness?.length ?? 0}) ===`)
  readiness?.forEach(r => console.log(`  overall:${String(r.overall).padEnd(3)} prep:${String(r.preparation).padEnd(3)} conf:${String(r.confidence).padEnd(3)} perf:${String(r.performance ?? '-').padEnd(3)} stage:${r.maturity_stage ?? '-'} ${r.calculated_at.slice(0, 16)}`))

  // Conversations
  const { data: convos } = await supabase.from('conversations').select('id, type, status, created_at').eq('business_id', bid).order('created_at', { ascending: false }).limit(5)
  console.log(`\n=== RECENT CONVERSATIONS (${convos?.length ?? 0}) ===`)
  convos?.forEach(c => console.log(`  ${c.type.padEnd(12)} ${c.status.padEnd(8)} ${c.created_at.slice(0, 10)}`))

  // Mia Skills
  const { data: skills } = await supabase.from('mia_skills').select('skill_key, skill_name, level, status').eq('business_id', bid)
  console.log(`\n=== MIA SKILLS (${skills?.length ?? 0}) ===`)
  skills?.forEach(s => console.log(`  ${s.skill_name.padEnd(25)} lvl:${String(s.level).padEnd(3)} ${s.status}`))
}

main().catch(console.error)
