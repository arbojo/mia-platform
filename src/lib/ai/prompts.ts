import type { Database } from '@/lib/types'
import { authorityTag } from '@/lib/ai/knowledge'

type Business = Database['public']['Tables']['businesses']['Row']
type BrandIdentity = Database['public']['Tables']['brand_identities']['Row']
type Assistant = Database['public']['Tables']['assistants']['Row']
type Product = Database['public']['Tables']['products']['Row']
type KnowledgeItem = Database['public']['Tables']['knowledge_items']['Row']
type SalesRule = Database['public']['Tables']['sales_rules']['Row']
type AiInstruction = Database['public']['Tables']['ai_instructions']['Row']

interface BusinessMemory {
  id: string
  business_id: string
  memory_type: string
  category: string
  content: string
  evidence: Record<string, unknown>
  confidence: number
  first_observed_at: string
  last_observed_at: string
  observation_count: number
  is_active: boolean
  is_immutable: boolean
  rationale?: string
  decision_priority?: string
  expires_at?: string
  created_at: string
  updated_at: string
}

interface Personality {
  warmth: number
  formality: number
  humor: number
  sales_aggressiveness: number
}

interface RecentLesson {
  id: string
  original_response: string
  corrected_response: string | null
  correction_type: string
  severity?: string | null
  category?: string | null
  created_at: string
}

function getPersonalityLabel(personality: Personality): string {
  const labels: string[] = []

  if (personality.warmth > 70) labels.push('cálida y cercana')
  else if (personality.warmth < 30) labels.push('profesional y distante')

  if (personality.formality > 70) labels.push('formal')
  else if (personality.formality < 30) labels.push('casual')

  if (personality.humor > 70) labels.push('con buen humor')
  else if (personality.humor < 30) labels.push('seria')

  if (personality.sales_aggressiveness > 70) labels.push('proactiva en ventas')
  else if (personality.sales_aggressiveness < 30) labels.push('consultiva, no agresiva')

  return labels.length > 0 ? labels.join(', ') : 'equilibrada'
}

function formatProducts(products: Product[]): string {
  if (products.length === 0) return 'Aún no hay productos registrados.'

  return products
    .map((p) => {
      const lines = [`- ${p.name}: $${p.price ?? 'sin precio definido'}`, `  ${p.description ?? ''}`, `  Beneficios: ${p.benefits ?? 'no especificados'}`]
      const faq = p.faq as Array<{ q: string; a: string }> | null
      if (faq && faq.length > 0) {
        lines.push(`  Preguntas frecuentes:`)
        faq.slice(0, 3).forEach((f) => lines.push(`    - ${f.q}: ${f.a}`))
      }
      if (p.restrictions) {
        lines.push(`  Restricciones: ${p.restrictions}`)
      }
      return lines.join('\n')
    })
    .join('\n\n')
}

function formatRules(rules: SalesRule[]): string {
  if (rules.length === 0) return 'Aún no hay reglas de venta definidas.'

  return rules
    .map((r) => `- [REGLA:PRIORIDAD ${r.priority}][${r.category}] ${r.content}`)
    .join('\n')
}

function formatInstructions(instructions: AiInstruction[]): string {
  if (instructions.length === 0) return ''

  return instructions
    .map((i) => {
      const tag = authorityTag({ source: i.source, is_immutable: null, memory_type: null })
      return `- [INSTRUCCIÓN${tag ? `:${tag}` : ''}] ${i.instruction}`
    })
    .join('\n')
}

function formatKnowledge(knowledge: KnowledgeItem[]): string {
  if (knowledge.length === 0) return ''

  return knowledge
    .map((k) => {
      const tag = authorityTag({ source: k.source, is_immutable: null, memory_type: null })
      return `[CONOCIMIENTO${tag ? `:${tag}` : ''}] Pregunta: ${k.question}\nRespuesta: ${k.answer}`
    })
    .join('\n\n')
}

function formatBusinessMemory(memory: BusinessMemory[]): string {
  if (memory.length === 0) return ''

  return memory
    .map((m) => {
      const tag = authorityTag({ source: null, is_immutable: m.is_immutable, memory_type: m.memory_type })
      return `- [MEMORIA${tag ? `:${tag}` : ''}][${m.category}] ${m.content}${m.rationale ? `\n  Razón: ${m.rationale}` : ''}${m.is_immutable ? ' (DECISIÓN FINAL)' : ''}`
    })
    .join('\n\n')
}

function formatLessons(lessons: RecentLesson[]): string {
  if (lessons.length === 0) return ''

  const sorted = [...lessons].sort((a, b) => {
    const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
    const aSev = sevOrder[a.severity ?? 'low'] ?? 3
    const bSev = sevOrder[b.severity ?? 'low'] ?? 3
    if (aSev !== bSev) return aSev - bSev
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const lessonLines = sorted.map((l) => {
    const typeLabel = l.correction_type === 'rule' ? 'regla' : 
                      l.correction_type === 'instruction' ? 'instrucción' : 'conocimiento'
    const severityTag = l.severity && l.severity !== 'medium' ? `[${l.severity.toUpperCase()}]` : ''
    const categoryTag = l.category ? `[${l.category}]` : ''
    const corrected = l.corrected_response ?? '(eliminado/desestimado)'
    return `- ${severityTag}${categoryTag}[${typeLabel}] "${l.original_response}" → "${corrected}"`
  })

  return lessonLines.join('\n')
}

export function buildMasterPrompt(params: {
  business: Business
  brand: BrandIdentity | null
  assistant: Assistant
  products: Product[]
  rules: SalesRule[]
  instructions: AiInstruction[]
  knowledge: KnowledgeItem[]
  memory?: BusinessMemory[]
  customerMemory?: string
  recentLessons?: RecentLesson[]
}): string {
  const { business, brand, assistant, products, rules, instructions, knowledge, memory, customerMemory, recentLessons } = params

  const personality = assistant.personality as unknown as Personality
  const personalityLabel = getPersonalityLabel(personality)

  const toneNote = brand?.tone_of_voice
    ? `\n\nNota: La marca ha definido su tono como: "${brand.tone_of_voice}". Este tono es la guía general de la marca. Si hay conflicto con tu estilo personal, prioriza la personalidad del asistente para la interacción directa, pero mantén el tono de marca como marco general.`
    : ''

  return `Eres ${assistant.name}, la asistente de ventas de ${brand?.business_name ?? business.name}.

## Tu Objetivo
Ayudar a los clientes a encontrar lo que necesitan, respetando las reglas del negocio.
Vender con naturalidad, sin presionar artificialmente.

## Tu Personalidad
Tu estilo es: ${personalityLabel}

## Estilo de Comunicación
Maneja un estilo ${assistant.communication_style}.${toneNote}

## Reglas Fundamentales
1. NUNCA inventes información que no esté en tu conocimiento.
2. Si no sabes algo, di: "Déjame revisar eso con el equipo."
3. Siempre pregunta la ciudad antes de prometer envío.
4. No menciones descuentos a menos que el cliente pregunte o estén en reglas.
5. Si el cliente pide hablar con alguien, indica que puedes conectarlo con el equipo.

## Resolución de Conflictos
Si encuentras información contradictoria entre diferentes fuentes, aplica este orden de autoridad:

1. Las DECISIONES INMUTABLES [INMUTABLE] del negocio siempre prevalecen sobre cualquier otra fuente.
2. Las INSTRUCCIONES MANUALES [MANUAL] del dueño del negocio prevalecen sobre reglas y conocimiento.
3. Las REGLAS DE VENTA [REGLA] con prioridad más alta prevalecen sobre las de prioridad más baja.
4. El CONOCIMIENTO REVISADO [CORRECCIÓN] prevalece sobre conocimiento importado [DOCUMENTO].
5. El CONOCIMIENTO RECIENTE prevalece sobre el antiguo (fecha de creación).
6. Los PATRONES estadísticos [PATRÓN] tienen la menor autoridad.

Si después de aplicar estas reglas el conflicto persiste:
- Si afecta precios: Pregunta al cliente qué fuente consultó.
- Si afecta reglas de negocio: Escala a un asesor humano.
- Si es una contradicción sin riesgo: Usa la información más reciente.

## Autonomía
Puedes:
- explicar productos
- resolver dudas
- recomendar opciones
- responder preguntas frecuentes

No puedes:
- cambiar precios
- prometer excepciones
- inventar promociones
- confirmar pedidos sin validar reglas
- dar información que no esté en tu conocimiento

## Información del Negocio
${brand?.elevator_pitch ?? 'Aún no se ha configurado la información del negocio.'}
${brand?.target_customers ? `\nClientes objetivo: ${brand.target_customers}` : ''}
${brand?.differentiators ? `\nLo que nos diferencia: ${brand.differentiators}` : ''}

## Productos
${formatProducts(products)}

## Reglas de Venta
${formatRules(rules)}
${formatInstructions(instructions) ? `\n## Instrucciones Adicionales\n${formatInstructions(instructions)}` : ''}
${formatKnowledge(knowledge) ? `\n## Conocimiento Adicional\n${formatKnowledge(knowledge)}` : ''}
${memory && memory.length > 0 ? `\n## Memoria Interna del Negocio\n${formatBusinessMemory(memory)}` : ''}
${customerMemory ? `\n## Memoria del Cliente\n${customerMemory}` : ''}
${formatLessons(recentLessons ?? []) ? `\n## Lo que he aprendido de ti\nÚltimas correcciones que me enseñaste:\n${formatLessons(recentLessons ?? [])}` : ''}

## Instrucción Final
ANTES DE RESPONDER: Revisa activamente si hay información contradictoria entre las secciones anteriores. Si encuentras contradicciones, aplica el orden de autoridad de Resolución de Conflictos. No mezcles reglas incompatibles.`
}
