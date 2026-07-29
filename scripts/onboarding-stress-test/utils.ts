import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { config } from 'dotenv'
config({ path: '.env.local' })

export const TOKEN_COSTS = { 'gpt-4o-mini': { input: 0.15, output: 0.60 } }

export function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export function getOpenAI(): OpenAI {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const costs = TOKEN_COSTS[model as keyof typeof TOKEN_COSTS] ?? { input: 0.15, output: 0.60 }
  return (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000
}

export function elapsedMs(start: number): number {
  return Date.now() - start
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

export interface ExtractionRecord {
  docId: string
  title: string
  type: string
  category: string
  inputTokens: number
  outputTokens: number
  cost: number
  durationMs: number
  success: boolean
  error?: string
  extractedContent?: string
}

export class MetricsCollector {
  extractionRecords: ExtractionRecord[] = []
  dbQueries: Array<{ operation: string; durationMs: number }> = []
  failures: string[] = []
  businessId: string | null = null
  assistantId: string | null = null
  startTime = Date.now()

  setBizIds(bizId: string, asstId: string): void {
    this.businessId = bizId
    this.assistantId = asstId
  }

  recordExtraction(rec: ExtractionRecord): void {
    this.extractionRecords.push(rec)
  }

  recordDbQuery(operation: string, durationMs: number): void {
    this.dbQueries.push({ operation, durationMs })
  }

  recordFailure(error: string): void {
    this.failures.push(error)
  }

  totalTokens(): { input: number; output: number } {
    return this.extractionRecords.reduce(
      (acc, r) => ({ input: acc.input + r.inputTokens, output: acc.output + r.outputTokens }),
      { input: 0, output: 0 }
    )
  }

  totalCost(): number {
    return this.extractionRecords.reduce((sum, r) => sum + r.cost, 0)
  }

  elapsed(): number {
    return Date.now() - this.startTime
  }
}

export function classifyWithLLM(document: { title: string; content: string; type: string }, openai: OpenAI): Promise<{
  category: string
  entities: Array<{ table: string; data: Record<string, unknown> }>
  conflicts: Array<{ description: string; severity: string }>
}> {
  return openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Eres un sistema de extracción de información empresarial. Analiza el documento y extrae su contenido en estructuras JSON.

Para cada tabla, usa EXACTAMENTE estos campos y valores permitidos:

**products**: { "name": string, "price": number, "description": string, "benefits": string }

**knowledge_items**: category debe ser UNO de: 'business_info' | 'faq' | 'objection' | 'process' | 'tip'
  { "category": "faq"|"process"|"tip"|"business_info"|"objection", "question": string, "answer": string }

**sales_rules**: category debe ser UNO de: 'zones' | 'payment' | 'schedule' | 'promotions' | 'restrictions' | 'escalation'
  { "category": "promotions"|"restrictions"|"payment"|"schedule"|"zones"|"escalation", "content": string, "priority": number }

**ai_instructions**: { "instruction": string, "priority": number }

**business_memory**: memory_type debe ser UNO de: 'pattern' | 'experience' | 'insight' | 'trend'
  category debe ser UNO de: 'customer_behavior' | 'product_performance' | 'sales_pattern' | 'objection_trend' | 'faq_frequency' | 'delivery_question' | 'payment_question' | 'warranty_question' | 'pricing_question' | 'competition_question'
  { "memory_type": "insight"|"pattern"|"experience"|"trend", "category": "customer_behavior"|"product_performance"|"sales_pattern"|"objection_trend"|"faq_frequency"|"delivery_question"|"payment_question"|"warranty_question"|"pricing_question"|"competition_question", "content": string }

Responde SOLO con JSON:
{
  "category": "products|knowledge_items|sales_rules|ai_instructions|business_memory",
  "entities": [
    {
      "table": "products|knowledge_items|sales_rules|ai_instructions|business_memory",
      "data": { campos exactos y valores permitidos según la tabla arriba }
    }
  ],
  "conflicts": [
    { "description": "descripción del conflicto detectado", "severity": "alta|media|baja" }
  ]
}

IMPORTANTE: price debe ser solo número, sin símbolos ni moneda. Los campos deben llamarse exactamente como se especifica. category debe usar solo los valores permitidos.`
      },
      { role: 'user', content: `Documento: ${document.title}\n\n---\n\n${document.content}` },
    ],
    temperature: 0.1,
    max_tokens: 1000,
    response_format: { type: 'json_object' },
  }).then((completion) => {
    const content = completion.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(content)
    return {
      category: parsed.category ?? 'knowledge_items',
      entities: parsed.entities ?? [],
      conflicts: parsed.conflicts ?? [],
    }
  })
}
