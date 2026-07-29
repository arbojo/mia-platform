import { getSupabase, getOpenAI, calculateCost, elapsedMs, MetricsCollector } from './utils'
import { BusinessDef } from './config'

export async function phase8TimeLapse(defs: BusinessDef[], simulatedDays: number, metrics: MetricsCollector): Promise<void> {
  metrics.startPhase('8. Time-Lapse Simulation')
  const supabase = getSupabase()
  const openai = getOpenAI()

  const schedule = [
    { day: 1, event: 'onboarding' },
    { day: [2, 3, 4, 5, 6, 7], event: 'conversations', count: 3 },
    { day: 8, event: 'corrections' },
    { day: 10, event: 'learning_report' },
    { day: 15, event: 'mentor_mode' },
    { day: 20, event: 'new_products' },
    { day: 30, event: 'final_evaluation' },
  ]

  for (let day = 1; day <= simulatedDays; day++) {
    const dayEvents = schedule.filter((s) => {
      if (Array.isArray(s.day)) return s.day.includes(day)
      return s.day === day
    })

    if (dayEvents.length > 0) {
      console.log(`  Day ${day}: ${dayEvents.map((e) => e.event).join(', ')}`)
    }

    for (const event of dayEvents) {
      for (const b of defs) {
        const bizId = metrics.getBizId(b.name)
        const asstId = metrics.getAsstId(b.name)
        if (!bizId || !asstId) continue

        switch (event.event) {
          case 'conversations': {
            for (let ci = 0; ci < (event.count ?? 3); ci++) {
              try {
                const completion = await openai.chat.completions.create({
                  model: 'gpt-4o-mini',
                  messages: [{
                    role: 'user',
                    content: `Genera una breve conversación de 2 mensajes para ${b.brand.business_name}. Cliente pregunta algo, asistente responde. JSON: {"customer": "...", "assistant": "..."}`
                  }],
                  temperature: 0.8,
                  max_tokens: 500,
                })
                const inputTokens = completion.usage?.prompt_tokens ?? 0
                const outputTokens = completion.usage?.completion_tokens ?? 0
                metrics.recordAiCall({
                  operationType: 'conversation',
                  model: 'gpt-4o-mini',
                  inputTokens, outputTokens,
                  cost: calculateCost('gpt-4o-mini', inputTokens, outputTokens),
                  durationMs: elapsedMs(Date.now()),
                  businessId: bizId,
                  success: true,
                })
              } catch { /* skip per-day conv errors */ }
            }
            break
          }
          case 'corrections': {
            try {
              await supabase.from('learning_events').insert({
                business_id: bizId,
                assistant_id: asstId,
                original_response: 'Respuesta genérica sin personalizar.',
                corrected_response: 'Respuesta personalizada basada en el historial del cliente.',
                correction_type: 'knowledge',
                status: 'approved',
                severity: 'low',
                is_active: true,
              })
            } catch { /* non-critical */ }
            break
          }
          case 'new_products': {
            try {
              await supabase.from('products').insert({
                business_id: bizId,
                name: `${b.brand.business_name} - Nuevo Producto`,
                price: 299,
                description: 'Producto añadido durante la simulación de crecimiento.',
                benefits: 'Beneficio del nuevo producto.',
                is_active: true,
              })
            } catch { /* non-critical */ }
            break
          }
          case 'final_evaluation': {
            try {
              const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{
                  role: 'user',
                  content: `Genera un breve reporte de evolución para ${b.brand.business_name}. Incluye: nivel de conocimiento actual, áreas de mejora, logros. JSON: {"knowledge_level": 0-100, "improvements": [], "achievements": []}`
                }],
                temperature: 0.5,
                max_tokens: 500,
              })
              const inputTokens = completion.usage?.prompt_tokens ?? 0
              const outputTokens = completion.usage?.completion_tokens ?? 0
              metrics.recordAiCall({
                operationType: 'report_generation',
                model: 'gpt-4o-mini',
                inputTokens, outputTokens,
                cost: calculateCost('gpt-4o-mini', inputTokens, outputTokens),
                durationMs: elapsedMs(Date.now()),
                businessId: bizId,
                success: true,
              })
            } catch { /* skip */ }
            break
          }
          default: break
        }
      }
    }
  }

  console.log(`  Simulated ${simulatedDays} days across ${defs.length} businesses`)
  metrics.recordData('simulatedDays', simulatedDays)
  metrics.endPhase()
}