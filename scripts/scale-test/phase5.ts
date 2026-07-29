import { getSupabase, getOpenAI, calculateCost, elapsedMs, MetricsCollector } from './utils'
import { BusinessDef } from './config'

export async function phase5MentorMode(defs: BusinessDef[], metrics: MetricsCollector): Promise<void> {
  metrics.startPhase('5. Mentor Mode Test')
  const supabase = getSupabase()
  const openai = getOpenAI()

  for (const b of defs) {
    const bizId = metrics.getBizId(b.name)
    const asstId = metrics.getAsstId(b.name)
    if (!bizId || !asstId) {
      metrics.recordFailure(`Phase5: Missing IDs for ${b.name}`)
      continue
    }

    try {
      const scenarioPrompt = `Genera un escenario de venta realista para "${b.brand.business_name}" (${b.industry}).
El escenario debe incluir un cliente con una necesidad específica y una objeción realista.

Responde SOLO con JSON:
{
  "scenario": "Descripción del escenario",
  "customer_needs": "qué necesita el cliente",
  "objection": "objeción realista del cliente",
  "expected_handling": "cómo debería responder MIA"
}`

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: scenarioPrompt }],
        temperature: 0.7,
        max_tokens: 1000,
      })

      const inputTokens = completion.usage?.prompt_tokens ?? 0
      const outputTokens = completion.usage?.completion_tokens ?? 0
      const cost = calculateCost('gpt-4o-mini', inputTokens, outputTokens)

      metrics.recordAiCall({
        operationType: 'mentor_mode',
        model: 'gpt-4o-mini',
        inputTokens,
        outputTokens,
        cost,
        durationMs: elapsedMs(Date.now()),
        businessId: bizId,
        success: true,
      })

      const content = completion.choices[0]?.message?.content ?? '{}'
      let parsed: Record<string, unknown> = {}
      try { parsed = JSON.parse(content.replace(/```json?/gi, '').replace(/```/g, '').trim()) } catch { /* skip */ }

      try {
        await supabase.from('lab_sessions').insert({
          business_id: bizId,
          assistant_id: asstId,
          mode: 'mentor',
          title: `Mentor: ${b.name}`,
          status: 'completed',
          message_count: 0,
          evaluation_model: 'gpt-4o-mini',
        })
      } catch { /* non-critical */ }

      const extractionPrompt = `Basado en este escenario de venta, extrae las reglas de negocio implícitas y las decisiones estratégicas que el dueño debería considerar.

Escenario: ${(parsed.scenario as string) ?? content.slice(0, 500)}

Responde SOLO con JSON:
{
  "hidden_rules": [{"rule": "regla inferida", "confidence": 0-100}],
  "decisions": [{"decision": "decisión estratégica", "rationale": "por qué"}],
  "sales_patterns": [{"pattern": "patrón detectado", "evidence": "base"}]
}`

      const extrCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: extractionPrompt }],
        temperature: 0.3,
        max_tokens: 1000,
      })

      const extrInput = extrCompletion.usage?.prompt_tokens ?? 0
      const extrOutput = extrCompletion.usage?.completion_tokens ?? 0
      const extrCost = calculateCost('gpt-4o-mini', extrInput, extrOutput)

      metrics.recordAiCall({
        operationType: 'mentor_mode',
        model: 'gpt-4o-mini',
        inputTokens: extrInput,
        outputTokens: extrOutput,
        cost: extrCost,
        durationMs: elapsedMs(Date.now()),
        businessId: bizId,
        success: true,
      })

      console.log(`  ✓ ${b.name}: Mentor scenario + extraction completed ($${cost.toFixed(6)} + $${extrCost.toFixed(6)})`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      metrics.recordFailure(`Phase5/${b.name}: ${msg}`)
    }
  }

  metrics.endPhase()
}