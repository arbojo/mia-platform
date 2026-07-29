import { getSupabase, getOpenAI, calculateCost, elapsedMs, MetricsCollector } from './utils'
import { BusinessDef } from './config'

function generateSyntheticDocument(b: BusinessDef): string {
  const lines: string[] = [
    `DESCRIPCIÓN DEL NEGOCIO:`,
    `${b.brand.business_name} — ${b.brand.tagline}`,
    `${b.brand.elevator_pitch}`,
    ``,
    `CLIENTES TÍPICOS:`,
    `${b.brand.target_customers}`,
    ``,
    `LO QUE NOS HACE ESPECIALES:`,
    `${b.brand.differentiators}`,
    ``,
    `PRODUCTOS:`,
  ]
  for (const p of b.baseProducts) {
    lines.push(`- ${p.name}: $${p.price}. ${p.description}. Beneficios: ${p.benefits}`)
    lines.push(`  Pregunta frecuente: ¿Qué precio tiene? Respuesta: Cuesta $${p.price}.`)
  }
  lines.push(``, `POLÍTICAS DE VENTA:`)
  for (const r of b.baseRules) {
    lines.push(`- [${r.category}] ${r.content}`)
  }
  return lines.join('\n')
}

function countTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export async function phase2KnowledgeLoading(defs: BusinessDef[], docCount: number, metrics: MetricsCollector): Promise<void> {
  metrics.startPhase('2. Knowledge Loading Stress Test')
  const supabase = getSupabase()
  const openai = getOpenAI()
  const docsPerBiz = Math.max(1, Math.ceil(docCount / defs.length))

  let totalDocs = 0
  let totalExtractions = 0
  let totalFailures = 0

  for (const b of defs) {
    const bizId = metrics.getBizId(b.name)
    if (!bizId) {
      metrics.recordFailure(`Phase2: No business ID for ${b.name}`)
      continue
    }
    const asstId = metrics.getAsstId(b.name)
    if (!asstId) {
      metrics.recordFailure(`Phase2: No assistant ID for ${b.name}`)
      continue
    }

    for (let d = 0; d < docsPerBiz; d++) {
      totalDocs++
      const doc = generateSyntheticDocument(b)
      const docStart = Date.now()

      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `Eres un extractor de datos. Analiza el texto y extrae productos, conocimientos y reglas de negocio.
Responde SOLO con JSON:
{
  "products": [{"name": string, "price": number|null, "description": string, "benefits": string}],
  "knowledge": [{"category": "faq"|"business_info"|"tip"|"objection", "question": string, "answer": string}],
  "rules": [{"category": "zones"|"payment"|"schedule"|"promotions"|"restrictions"|"escalation", "content": string}]
}`
            },
            { role: 'user', content: doc },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        })

        const duration = elapsedMs(docStart)
        const inputTokens = completion.usage?.prompt_tokens ?? countTokens(doc)
        const outputTokens = completion.usage?.completion_tokens ?? 500
        const cost = calculateCost('gpt-4o-mini', inputTokens, outputTokens)
        const content = completion.choices[0]?.message?.content ?? '{}'

        let parsed: { products?: unknown[]; knowledge?: unknown[]; rules?: unknown[] }
        try {
          parsed = JSON.parse(content.replace(/```json?/gi, '').replace(/```/g, '').trim())
        } catch {
          parsed = { products: [], knowledge: [], rules: [] }
        }

        metrics.recordAiCall({
          operationType: 'knowledge_extraction',
          model: 'gpt-4o-mini',
          inputTokens,
          outputTokens,
          cost,
          durationMs: duration,
          businessId: bizId,
          success: true,
        })

        totalExtractions++
        const pCount = parsed.products?.length ?? 0
        const kCount = parsed.knowledge?.length ?? 0
        const rCount = parsed.rules?.length ?? 0
        const allCount = pCount + kCount + rCount

        console.log(`    Doc ${d + 1}/${docsPerBiz} for ${b.name}: ${pCount} products, ${kCount} knowledge, ${rCount} rules | $${cost.toFixed(6)} | ${duration}ms`)
      } catch (err) {
        totalFailures++
        const msg = err instanceof Error ? err.message : String(err)
        metrics.recordFailure(`Phase2/${b.name} doc ${d}: ${msg}`)
        console.error(`    ✗ Document ${d + 1} FAILED: ${msg}`)
      }
    }
  }

  console.log(`  Processed ${totalDocs} documents, ${totalExtractions} successful extractions, ${totalFailures} failures`)
  metrics.recordData('docsProcessed', totalDocs)
  metrics.recordData('successfulExtractions', totalExtractions)
  metrics.recordData('extractionFailures', totalFailures)
  metrics.endPhase()
}