import { generateObject } from 'ai'
import { z } from 'zod'
import { recordAiUsage } from '@/lib/ai/knowledge'
import { getProviderModel } from '@/lib/ai/task-routing'

export interface ExtractedProduct {
  name: string
  price: number | null
  description: string | null
  benefits: string | null
  faq: Array<{ question: string; answer: string }>
  restrictions: string | null
  confidence: number
}

export interface ExtractedKnowledge {
  category: 'business_info' | 'faq' | 'objection' | 'process' | 'tip'
  question: string
  answer: string
  confidence: number
}

export interface ExtractedRule {
  category: 'zones' | 'payment' | 'schedule' | 'promotions' | 'restrictions' | 'escalation'
  content: string
  confidence: number
}

export interface MissingField {
  field: string
  reason: string
  importance: string
}

export interface ExtractionResult {
  products: ExtractedProduct[]
  knowledge: ExtractedKnowledge[]
  rules: ExtractedRule[]
  missingFields: MissingField[]
  summary: {
    productsFound: number
    pricesFound: number
    benefitsFound: number
    faqsFound: number
    promotionsFound: number
    knowledgeFound: number
    rulesFound: number
  }
}

const extractionSchema = z.object({
  products: z.array(z.object({
    name: z.string().describe('Nombre del producto tal como aparece en el documento'),
    price: z.number().nullable().describe('Precio del producto. null si no se encontró'),
    description: z.string().nullable().describe('Descripción del producto. null si no se encontró'),
    benefits: z.string().nullable().describe('Beneficios del producto. null si no se encontró'),
    faq: z.array(z.object({
      question: z.string().describe('Pregunta frecuente que un cliente haría'),
      answer: z.string().describe('Respuesta basada en la información del documento'),
    })).describe('Preguntas frecuentes generadas para este producto'),
    restrictions: z.string().nullable().describe('Restricciones o limitaciones. null si no se encontró'),
    confidence: z.number().min(0).max(100).describe('Confianza general en la extracción de este producto'),
  })).describe('Productos encontrados en el documento'),
  knowledge: z.array(z.object({
    category: z.enum(['business_info', 'faq', 'objection', 'process', 'tip']).describe('Categoría del conocimiento'),
    question: z.string().describe('Pregunta que un cliente haría'),
    answer: z.string().describe('Respuesta basada en el documento'),
    confidence: z.number().min(0).max(100).describe('Confianza en esta extracción'),
  })).describe('Conocimiento general del negocio encontrado'),
  rules: z.array(z.object({
    category: z.enum(['zones', 'payment', 'schedule', 'promotions', 'restrictions', 'escalation']).describe('Categoría de la regla'),
    content: z.string().describe('Contenido de la regla tal como se entiende'),
    confidence: z.number().min(0).max(100).describe('Confianza en esta regla'),
  })).describe('Reglas de negocio encontradas'),
  missingFields: z.array(z.object({
    field: z.string().describe('Campo que falta'),
    reason: z.string().describe('Por qué falta (qué se observó en el documento)'),
    importance: z.string().describe('Por qué es importante para el negocio y los clientes'),
  })).describe('Información que falta y es importante'),
})

export async function extractKnowledgeFromText(
  text: string,
  businessContext: string,
  businessId: string,
  assistantId: string
): Promise<ExtractionResult> {
  const prompt = `Eres MIA, una asistente de ventas IA estudiando documentos de un negocio.

CONTEXTO DEL NEGOCIO:
${businessContext}

TU TRABAJO:
Analiza el siguiente texto y extrae TODO el conocimiento útil que encuentres.

INSTRUCCIONES:
1. Identifica TODOS los productos con su información completa
2. Genera preguntas frecuentes que un cliente real haría sobre cada producto
3. Extrae reglas de negocio (pagos, envíos, promociones, restricciones)
4. Identifica qué información FALTA y explica POR QUÉ es importante para el negocio

CONFIANZA (0-100):
- 90-100: Lo vi claramente en el documento
- 70-89: Lo entendí con alta certeza
- 50-69: No estoy completamente segura
- 0-49: No encontré esta información o es muy incierta

REGLAS IMPORTANTES:
- NUNCA inventes información que no esté en el texto
- Si no estás segura de algo, asigna confianza baja
- Para missingFields, explica POR QUÉ le importa al negocio (no solo que falta)
- Genera FAQs realistas que un cliente de México haría
- Piensa como un vendedor experimentado que conoce el negocio
- Si el texto menciona promociones, descuentos o ofertas, extraelos como reglas
- Si encuentras ciudades o zonas de cobertura, extraelos como reglas

TEXTO A ANALIZAR:
${text}

IMPORTANTE: Responde SOLO con el JSON estructurado. No incluyas explicaciones fuera del JSON.`

  const { model, modelName } = getProviderModel('extraction')

  const result = await generateObject({
    model,
    schema: extractionSchema,
    prompt,
  })

  const extraction = result.object

  await recordAiUsage({
    business_id: businessId,
    assistant_id: assistantId,
    model: modelName,
    request_type: 'training',
    tokens_input: result.usage.inputTokens ?? 0,
    tokens_output: result.usage.outputTokens ?? 0,
    cost: 0,
  })

  const summary = {
    productsFound: extraction.products.length,
    pricesFound: extraction.products.filter((p) => p.price !== null).length,
    benefitsFound: extraction.products.filter((p) => p.benefits && p.benefits.trim().length > 0).length,
    faqsFound: extraction.products.reduce((sum, p) => sum + p.faq.length, 0) + extraction.knowledge.filter((k) => k.category === 'faq').length,
    promotionsFound: extraction.rules.filter((r) => r.category === 'promotions').length,
    knowledgeFound: extraction.knowledge.length,
    rulesFound: extraction.rules.length,
  }

  return {
    products: extraction.products,
    knowledge: extraction.knowledge,
    rules: extraction.rules,
    missingFields: extraction.missingFields,
    summary,
  }
}
