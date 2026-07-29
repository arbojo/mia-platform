import { getSupabase, getOpenAI, calculateCost, elapsedMs, MetricsCollector, AiCallRecord, printProgress } from './utils'
import { BusinessDef } from './config'

const CUSTOMER_SCENARIOS = [
  { type: 'basic_question', system: 'Actúa como un cliente interesado en comprar. Pregunta sobre precios, disponibilidad y envío de forma directa.', weight: 0.4 },
  { type: 'sales_objection', system: 'Actúa como un cliente que pone objeciones. El producto te parece caro, no estás seguro, comparas con la competencia o dudas de la calidad.', weight: 0.3 },
  { type: 'complex_question', system: 'Actúa como un cliente con necesidades específicas. Pregunta si el producto es adecuado para tu caso particular, hay restricciones, o necesitas recomendaciones.', weight: 0.2 },
  { type: 'adversarial', system: 'Actúa como un cliente difícil. Pides cosas imposibles, reclamas promesas que no se hicieron, o haces peticiones contradictorias.', weight: 0.1 },
]

function pickScenario(): typeof CUSTOMER_SCENARIOS[0] {
  const r = Math.random()
  let cumulative = 0
  for (const s of CUSTOMER_SCENARIOS) {
    cumulative += s.weight
    if (r <= cumulative) return s
  }
  return CUSTOMER_SCENARIOS[0]
}

function buildConversationPrompt(b: BusinessDef, scenario: typeof CUSTOMER_SCENARIOS[0]): string {
  const products = b.baseProducts.map((p) => `${p.name} - $${p.price}: ${p.description}`).join('\n')
  const rules = b.baseRules.map((r) => `[${r.category}] ${r.content}`).join('\n')
  return `Eres MIA, asistente de ventas de "${b.brand.business_name}".

INFORMACIÓN DEL NEGOCIO:
${b.brand.elevator_pitch}
Clientes: ${b.brand.target_customers}
Tono: ${b.brand.tone_of_voice}

PRODUCTOS:
${products}

REGLAS:
${rules}

INSTRUCCIONES:
${b.baseInstructions.join('\n')}

${scenario.system}

Genera una conversación corta de 3-4 mensajes (cliente y asistente).
Responde SOLO con JSON:
{
  "messages": [
    {"role": "customer", "content": "..."},
    {"role": "assistant", "content": "..."},
    {"role": "customer", "content": "..."},
    {"role": "assistant", "content": "..."}
  ]
}`
}

export async function phase3Conversations(defs: BusinessDef[], convsPerBiz: number, metrics: MetricsCollector): Promise<void> {
  metrics.startPhase('3. Conversation Simulation')
  const openai = getOpenAI()
  const supabase = getSupabase()
  let totalConvs = 0
  let totalTokens = 0
  let totalCost = 0
  let failures = 0

  for (let bi = 0; bi < defs.length; bi++) {
    const b = defs[bi]
    const bizId = metrics.getBizId(b.name)
    const asstId = metrics.getAsstId(b.name)

    if (!bizId || !asstId) {
      metrics.recordFailure(`Phase3: Missing IDs for ${b.name}`)
      continue
    }

    const { data: cust } = await supabase
      .from('customers')
      .insert({ business_id: bizId, name: 'Cliente Simulado', phone: '000-000-0000', status: 'new' })
      .select()
      .single()

    for (let ci = 0; ci < convsPerBiz; ci++) {
      totalConvs++
      if (totalConvs % 10 === 0 || totalConvs <= 3) {
        printProgress(3, 8, bi + 1, defs.length, ci + 1, convsPerBiz, {
          tokens: totalTokens,
          cost: totalCost,
          failures,
        })
      }

      const scenario = pickScenario()
      const prompt = buildConversationPrompt(b, scenario)
      const convStart = Date.now()

      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7 + Math.random() * 0.3,
          max_tokens: 1000,
        })

        const duration = elapsedMs(convStart)
        const inputTokens = completion.usage?.prompt_tokens ?? 0
        const outputTokens = completion.usage?.completion_tokens ?? 0
        const cost = calculateCost('gpt-4o-mini', inputTokens, outputTokens)
        totalTokens += inputTokens + outputTokens
        totalCost += cost
        const content = completion.choices[0]?.message?.content ?? '{}'

        metrics.recordAiCall({
          operationType: 'conversation',
          model: 'gpt-4o-mini',
          inputTokens,
          outputTokens,
          cost,
          durationMs: duration,
          businessId: bizId,
          success: true,
        })

        let convData: { messages?: Array<{ role: string; content: string }> } = {}
        try {
          convData = JSON.parse(content.replace(/```json?/gi, '').replace(/```/g, '').trim())
        } catch { /* skip parse errors */ }

        if (convData.messages && convData.messages.length > 0) {
          const { data: conversation } = await supabase
            .from('conversations')
            .insert({ assistant_id: asstId, customer_id: cust!.id, type: 'simulation', status: 'active' })
            .select()
            .single()

          if (conversation) {
            await supabase.from('messages').insert(
              convData.messages.map((m, idx) => ({
                conversation_id: conversation.id,
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content,
                created_at: new Date(Date.now() - (convData.messages!.length - idx) * 60000).toISOString(),
              }))
            )
          }

          const evalStart = Date.now()
          try {
            const evalResult = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: `Evalúa esta conversación de ventas. Puntúa del 1 al 10.
Responde SOLO con JSON: {"score": number, "product_knowledge": number, "empathy": number, "objection_handling": number, "closing": number, "rule_following": number, "strengths": string[], "weaknesses": string[]}`
                },
                {
                  role: 'user',
                  content: `Negocio: ${b.brand.business_name}\n\nConversación:\n${convData.messages.map((m) => `${m.role === 'customer' ? 'Cliente' : 'MIA'}: ${m.content}`).join('\n')}`
                },
              ],
              temperature: 0.3,
              max_tokens: 1000,
            })

            const evalDuration = elapsedMs(evalStart)
            const evalInput = evalResult.usage?.prompt_tokens ?? 0
            const evalOutput = evalResult.usage?.completion_tokens ?? 0
            const evalCost = calculateCost('gpt-4o-mini', evalInput, evalOutput)
            totalTokens += evalInput + evalOutput
            totalCost += evalCost

            metrics.recordAiCall({
              operationType: 'evaluation',
              model: 'gpt-4o-mini',
              inputTokens: evalInput,
              outputTokens: evalOutput,
              cost: evalCost,
              durationMs: evalDuration,
              businessId: bizId,
              success: true,
            })

            let evalScore = 0
            try {
              const evalContent = evalResult.choices[0]?.message?.content ?? '{}'
              const parsed = JSON.parse(evalContent.replace(/```json?/gi, '').replace(/```/g, '').trim())
              evalScore = parsed.score ?? 0
            } catch { /* skip */ }

            await supabase.from('lab_sessions').insert({
              business_id: bizId,
              assistant_id: asstId,
              conversation_id: conversation.id,
              mode: scenario.type === 'basic_question' ? 'normal' as const : 'normal' as const,
              title: `${b.name} conv ${ci + 1}`,
              status: 'completed',
              score: evalScore,
              evaluation_model: 'gpt-4o-mini',
              message_count: convData.messages.length,
            })
          } catch (err) {
            failures++
            metrics.recordFailure(`Phase3 eval conv ${totalConvs}: ${err instanceof Error ? err.message : String(err)}`)
          }
        }

        if (totalConvs % 20 === 0) {
          console.log(`  ✓ ${totalConvs} conversations processed | tokens: ${totalTokens} | cost: $${totalCost.toFixed(4)} | failures: ${failures}`)
        }
      } catch (err) {
        failures++
        const msg = err instanceof Error ? err.message : String(err)
        metrics.recordFailure(`Phase3 conv ${totalConvs}: ${msg}`)
      }
    }
  }

  console.log(`  Completed ${totalConvs} conversations, ${failures} failures`)
  metrics.recordData('conversationsCreated', totalConvs)
  metrics.recordData('conversationFailures', failures)
  metrics.endPhase()
}