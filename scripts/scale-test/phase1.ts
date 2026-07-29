import { getSupabase, MetricsCollector } from './utils'
import { BusinessDef, SCALE_TEST_OWNER_ID } from './config'

export async function phase1CreateBusinesses(defs: BusinessDef[], metrics: MetricsCollector): Promise<void> {
  metrics.startPhase('1. Synthetic Business Creation')
  const supabase = getSupabase()

  for (let i = 0; i < defs.length; i++) {
    const b = defs[i]
    console.log(`  Creating business ${i + 1}/${defs.length}: ${b.name} (${b.complexity})`)
    const start = Date.now()

    try {
      const { data: biz, error: bizErr } = await supabase
        .from('businesses')
        .insert({ owner_id: SCALE_TEST_OWNER_ID, name: b.name, onboarding_status: 'ready' })
        .select()
        .single()
      if (bizErr) throw new Error(`Business insert: ${bizErr.message}`)
      metrics.recordData(`business_${b.id}`, biz.id)

      const { error: brErr } = await supabase.from('brand_identities').insert({
        business_id: biz.id,
        business_name: b.brand.business_name,
        tagline: b.brand.tagline,
        target_customers: b.brand.target_customers,
        differentiators: b.brand.differentiators,
        elevator_pitch: b.brand.elevator_pitch,
        tone_of_voice: b.brand.tone_of_voice,
      })
      if (brErr) throw new Error(`Brand identity: ${brErr.message}`)

      const { data: asst, error: asErr } = await supabase
        .from('assistants')
        .insert({
          business_id: biz.id,
          name: b.assistantName,
          personality: b.personality,
          communication_style: b.communicationStyle,
          is_active: true,
        })
        .select()
        .single()
      if (asErr) throw new Error(`Assistant: ${asErr.message}`)
      metrics.recordData(`assistant_${b.id}`, asst.id)

      if (b.baseProducts.length > 0) {
        const { error: pErr } = await supabase.from('products').insert(
          b.baseProducts.map((p) => ({
            business_id: biz.id,
            name: p.name,
            price: p.price,
            description: p.description,
            benefits: p.benefits,
            faq: [],
            is_active: true,
          }))
        )
        if (pErr) throw new Error(`Products: ${pErr.message}`)
      }

      if (b.baseKnowledge.length > 0) {
        const { error: kErr } = await supabase.from('knowledge_items').insert(
          b.baseKnowledge.map((k) => ({
            business_id: biz.id,
            category: k.category,
            question: k.question,
            answer: k.answer,
            source: 'manual',
            confidence: 'high',
            is_active: true,
          }))
        )
        if (kErr) throw new Error(`Knowledge: ${kErr.message}`)
      }

      if (b.baseRules.length > 0) {
        const { error: rErr } = await supabase.from('sales_rules').insert(
          b.baseRules.map((r) => ({
            business_id: biz.id,
            category: r.category,
            content: r.content,
            priority: r.priority,
            is_active: true,
          }))
        )
        if (rErr) throw new Error(`Rules: ${rErr.message}`)
      }

      if (b.baseInstructions.length > 0) {
        const { error: iErr } = await supabase.from('ai_instructions').insert(
          b.baseInstructions.map((inst) => ({
            business_id: biz.id,
            instruction: inst,
            priority: 5,
            source: 'manual',
            is_active: true,
          }))
        )
        if (iErr) throw new Error(`Instructions: ${iErr.message}`)
      }

      const elapsed = Date.now() - start
      metrics.recordDbQuery('businesses', elapsed, 1)
      metrics.setIds(b.name, biz.id, asst.id)

      console.log(`    ✓ ${b.complexity} business — ${b.baseProducts.length} products, ${b.baseKnowledge.length} knowledge, ${b.baseRules.length} rules, ${b.baseInstructions.length} instructions (${elapsed}ms)`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      metrics.recordFailure(`Phase1/${b.name}: ${msg}`)
      console.error(`    ✗ FAILED: ${msg}`)
    }
  }

  console.log(`  Created ${defs.length} businesses`)
  metrics.recordData('businessesCreated', defs.length)
  metrics.endPhase()
}