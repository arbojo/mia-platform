import { getOpenAIClient, MODEL } from '@/lib/ai/client'
import type { EvidenceType } from '@/lib/reasoning/evidence'

const EVIDENCE_TYPES_LIST: EvidenceType[] = [
  'interest', 'trust', 'readiness', 'clarity', 'engagement',
  'hesitation', 'price_sensitivity', 'urgency', 'confusion', 'objection',
]

const EXTRACTION_SYSTEM_PROMPT = `Eres un extractor de señales de evidencia de clientes para un sistema de ventas conversacionales.

Dado un mensaje de un cliente, extrae TODAS las señales de evidencia presentes.

Para cada señal, devuelve:
- type: uno de los tipos permitidos
- weight: magnitud de la señal (0.0 a 1.0)
- confidence: qué tan seguro estás de la clasificación (0.0 a 1.0)

Tipos permitidos:
- interest: el cliente muestra interés en el producto
- trust: el cliente confía en la marca/vendedor
- readiness: el cliente está listo para comprar o tomar acción
- clarity: el cliente entiende bien el producto
- engagement: el cliente está invirtiendo esfuerzo en la conversación
- hesitation: el cliente duda o pospone
- price_sensitivity: el cliente menciona precio como factor
- urgency: el cliente tiene prisa o urgencia
- confusion: el cliente no entiende algo
- objection: el cliente tiene una objeción

REGLAS CRÍTICAS:
1. Distingue entre lenguaje hipotético y factual:
   - "quiero comprarlo" → readiness (factual)
   - "tal vez compre después" → hesitation (hipotético)
   - "¿cuánto cuesta?" → interest (exploratorio, NO readiness)
   - "no estoy seguro" → hesitation
   - "mi hermano ya compró" → no extraer como interest propio

2. NO infieras intención de compra solo por preguntas informativas.
3. Una pregunta sobre precio es interest, NO readiness.
4. "no me interesa" → interest baja (0.1-0.2), NO extraer como señal positiva.
5. Un solo mensaje puede contener múltiples señales.
6. Si no hay señales claras, devuelve un array vacío.

Responde SOLO con JSON válido. Sin explicaciones. Sin markdown.

Formato:
{
  "evidence": [
    { "type": "interest", "weight": 0.6, "confidence": 0.8 },
    { "type": "hesitation", "weight": 0.4, "confidence": 0.7 }
  ]
}`

export interface LLMExtractionResult {
  type: EvidenceType
  weight: number
  confidence: number
}

export async function extractEvidenceWithLLM(
  message: string
): Promise<LLMExtractionResult[]> {
  const openai = getOpenAIClient()

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: message },
      ],
      temperature: 0.1,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) return []

    const parsed = JSON.parse(content) as { evidence?: unknown[] }
    if (!parsed.evidence || !Array.isArray(parsed.evidence)) return []

    return parsed.evidence
      .filter((item): item is LLMExtractionResult => {
        if (typeof item !== 'object' || item === null) return false
        const obj = item as Record<string, unknown>
        if (typeof obj.type !== 'string') return false
        if (!EVIDENCE_TYPES_LIST.includes(obj.type as EvidenceType)) return false
        if (typeof obj.weight !== 'number' || obj.weight < 0 || obj.weight > 1) return false
        if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 1) return false
        return true
      })
      .map((item) => ({
        type: item.type as EvidenceType,
        weight: item.weight,
        confidence: item.confidence,
      }))
  } catch (err) {
    console.error('LLM evidence extraction failed:', err)
    return []
  }
}
