import type { Database } from '@/lib/types'
import { authorityTag } from '@/lib/ai/knowledge'
import type { Locale } from '@/lib/i18n/config'
import { DEFAULT_LOCALE } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import type { ChannelType } from '@/lib/channels/types'
import type { ResolvedCapabilities } from '@/lib/system/capabilities'

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

type PromptDict = ReturnType<typeof getDictionary>['ai']

export interface SalesPromptConfig {
  ask_address: boolean
  ask_phone: boolean
  allow_cancellation: boolean
  cancellation_window_hours: number
}

function buildClosingPolicy(aggressiveness: number, ai: PromptDict): string {
  if (aggressiveness > 70) return ai.closingProactive
  if (aggressiveness < 30) return ai.closingConsultative
  return ai.closingBalanced
}

function getPersonalityLabel(personality: Personality, ai: PromptDict): string {
  const labels: string[] = []

  if (personality.warmth > 70) labels.push(ai.personalityWarmClose)
  else if (personality.warmth < 30) labels.push(ai.personalityDistant)

  if (personality.formality > 70) labels.push(ai.personalityFormal)
  else if (personality.formality < 30) labels.push(ai.personalityCasual)

  if (personality.humor > 70) labels.push(ai.personalityHumorous)
  else if (personality.humor < 30) labels.push(ai.personalitySerious)

  if (personality.sales_aggressiveness > 70) labels.push(ai.personalityProactive)
  else if (personality.sales_aggressiveness < 30) labels.push(ai.personalityConsultative)

  return labels.length > 0 ? labels.join(', ') : ai.personalityBalanced
}

function formatProducts(products: Product[], ai: PromptDict): string {
  if (products.length === 0) return ai.noProducts

  return products
    .map((p) => {
      const lines = [
        `- ${p.name}: $${p.price ?? ai.noPrice}`,
        `  ${p.description ?? ''}`,
        `  ${ai.benefits}: ${p.benefits ?? ai.notSpecified}`,
      ]
      const faq = p.faq as Array<{ q: string; a: string }> | null
      if (faq && faq.length > 0) {
        lines.push(`  ${ai.faq}:`)
        faq.slice(0, 3).forEach((f) => lines.push(`    - ${f.q}: ${f.a}`))
      }
      if (p.restrictions) {
        lines.push(`  ${ai.restrictions}: ${p.restrictions}`)
      }
      return lines.join('\n')
    })
    .join('\n\n')
}

function formatRules(rules: SalesRule[], ai: PromptDict): string {
  if (rules.length === 0) return ai.noRules

  return rules
    .map((r) => `- [${ai.ruleTag}:${ai.priority} ${r.priority}][${r.category}] ${r.content}`)
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

function formatKnowledge(
  knowledge: KnowledgeItem[],
  ai: PromptDict,
  activeProductId?: string,
  channel?: ChannelType | 'simulation'
): string {
  if (knowledge.length === 0) return ''

  return knowledge
    .map((k) => {
      const tag = authorityTag({ source: k.source, is_immutable: null, memory_type: null })
      const belongsToActive = !activeProductId || !k.product_id || k.product_id === activeProductId
      const imageNote =
        k.image_url && k.trigger_condition && belongsToActive && channel
          ? `\n[IMAGEN_DISPONIBLE] ${ai.imageAvailable} ("${k.trigger_condition}").`
          : ''
      return `[CONOCIMIENTO${tag ? `:${tag}` : ''}] ${ai.knowledgeQuestion}: ${k.question}\n${ai.knowledgeAnswer}: ${k.answer}${imageNote}`
    })
    .join('\n\n')
}

function formatBusinessMemory(memory: BusinessMemory[], ai: PromptDict): string {
  if (memory.length === 0) return ''

  return memory
    .map((m) => {
      const tag = authorityTag({ source: null, is_immutable: m.is_immutable, memory_type: m.memory_type })
      return `- [MEMORIA${tag ? `:${tag}` : ''}][${m.category}] ${m.content}${m.rationale ? `\n  ${ai.reason}: ${m.rationale}` : ''}${m.is_immutable ? ` (${ai.finalDecision})` : ''}`
    })
    .join('\n\n')
}

function formatLessons(lessons: RecentLesson[], ai: PromptDict): string {
  if (lessons.length === 0) return ''

  const sorted = [...lessons].sort((a, b) => {
    const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
    const aSev = sevOrder[a.severity ?? 'low'] ?? 3
    const bSev = sevOrder[b.severity ?? 'low'] ?? 3
    if (aSev !== bSev) return aSev - bSev
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const lessonLines = sorted.map((l) => {
    const typeLabel =
      l.correction_type === 'rule'
        ? ai.lessonRule
        : l.correction_type === 'instruction'
          ? ai.lessonInstruction
          : ai.lessonKnowledge
    const severityTag = l.severity && l.severity !== 'medium' ? `[${l.severity.toUpperCase()}]` : ''
    const categoryTag = l.category ? `[${l.category}]` : ''
    const corrected = l.corrected_response ?? ai.removedDiscarded
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
  locale?: Locale
  channel?: ChannelType | 'simulation'
  intentTag?: string | null
  salesConfig?: SalesPromptConfig
  experienceContext?: string
  conversationOutcome?: string | null
  cancellationContext?: { orderNumber: string; hoursAgo: number } | null
  lastCancelledOrder?: { productName: string | null; cancelledAt: string; hoursAgo: number; pending?: boolean } | null
  userIntent?: 'explicit_purchase' | 'casual' | 'order_reference' | null
  landingContext?: {
    brand?: string
    product?: string
    productId?: string
  }
  stateGuidance?: {
    state_section: string
    permitted_actions: string[]
    prohibited_actions: string[]
    guidance: string
  }
  capabilities?: ResolvedCapabilities
}): string {
  const {
    business,
    brand,
    assistant,
    products,
    rules,
    instructions,
    knowledge,
    memory,
    customerMemory,
    recentLessons,
    locale,
    channel,
    intentTag,
    salesConfig,
    conversationOutcome,
    cancellationContext,
    lastCancelledOrder,
    userIntent,
    experienceContext,
    landingContext,
    stateGuidance,
    capabilities,
  } = params

  const ai = getDictionary(locale ?? DEFAULT_LOCALE).ai

  const personality = assistant.personality as unknown as Personality
  const personalityLabel = getPersonalityLabel(personality, ai)

  const toneNote = brand?.tone_of_voice
    ? `\n\n${ai.toneNote} "${brand.tone_of_voice}".`
    : ''

  const channelNote =
    channel === 'whatsapp'
      ? `\n\n${ai.whatsappTone}\n\n${ai.waOrderCapture}${intentTag ? `\n\n${ai.intentTagDirective} INTENT_TAG: ${intentTag}` : ''}`
      : intentTag
        ? `\n\n${ai.intentTagDirective} INTENT_TAG: ${intentTag}`
        : ''

  const landingNote = landingContext
    ? `\n\n## Contexto de esta página\nEstás incrustado en la página de venta de ${landingContext.brand ?? business.name}. Tu trabajo es resolver dudas y vender dentro de esta página. NUNCA pidas datos personales ni de pedido en el chat (nombre, teléfono, dirección, ciudad): esos datos los captura el formulario de compra de la página. Cuando el cliente muestre intención de compra (pregunte por precio, envío o formas de pago), invítalo a completar su pedido en el formulario de la misma página y no lo envíes a ningún otro sitio.`
    : ''

  const activeProduct = landingContext ? products[0] : undefined
  const productContextNote =
    landingContext && activeProduct
      ? `\n\n## Producto activo\nEsta página y esta campaña promocionan **${activeProduct.name}**${activeProduct.price ? ` ($${activeProduct.price})` : ''}. Cuando el cliente pregunte por "precio", "más información", "beneficios" u otras peticiones genéricas sin especificar producto, ancla tu respuesta a **${activeProduct.name}**: prioriza su información y su multimedia sobre el resto del catálogo y no lo confundas con otros productos.`
      : ''

  return `${ai.youAre} ${assistant.name}, ${ai.salesAssistantOf} ${brand?.business_name ?? business.name}. ${ai.salesPurpose}

## ${ai.yourObjective}
${ai.objectiveText}

## ${ai.languageMatching}

## ${ai.yourPersonality}
${ai.personalityStyle}: ${personalityLabel}

## ${ai.communicationStyle}
${ai.communicationStyleText} ${assistant.communication_style}.${toneNote}${channelNote}${landingNote}${productContextNote}

## ${ai.fundamentalRules}
1. ${ai.neverInvent}
2. ${ai.offTopicBridge}
3. ${ai.ifUnsure}
4. ${ai.knowledgeBoundary}
5. ${ai.askCity}
6. ${ai.noDiscounts}
7. ${ai.humanHandoff}

## ${ai.responseFormat}
${ai.responseFormatText}
${ai.recommendationFormat}

## ${ai.conflictResolution}
${ai.conflictIntro}

1. ${ai.immutableDecisions}
2. ${ai.manualInstructions}
3. ${ai.higherPriorityRules}
4. ${ai.reviewedKnowledge}
5. ${ai.recentKnowledge}
6. ${ai.statisticalPatterns}

${ai.conflictPersists}
- ${ai.priceConflict}
- ${ai.businessRuleConflict}
- ${ai.harmlessConflict}

## ${ai.autonomy}
${ai.canDo}
- ${ai.explainProducts}
- ${ai.resolveDoubts}
- ${ai.recommendOptions}
- ${ai.answerFaqs}

${ai.cannotDo}
- ${ai.changePrices}
- ${ai.promiseExceptions}
- ${ai.inventPromotions}
- ${ai.confirmOrders}
- ${ai.giveUnverified}

## ${ai.closingPolicy}
${buildClosingPolicy(personality.sales_aggressiveness, ai)}

${ai.deliveryPromiseRule}

${ai.rejectionPivotRule}

## ${ai.salesClosingControl}
${ai.closingMaxAttempts}
${ai.closingDeclineStop}
${ai.closingTopicShift}
${salesConfig ? `${salesConfig.ask_address ? ai.salesAskAddress : ''}${salesConfig.ask_phone ? ai.salesAskPhone : ''}` : ''}
${salesConfig?.allow_cancellation ? ai.salesCancellationAllowed.replace('{hours}', String(salesConfig.cancellation_window_hours)) : ai.salesCancellationDenied}

## ${ai.businessInfo}
${brand?.elevator_pitch ?? ai.noBusinessInfo}
${brand?.target_customers ? `\n${ai.targetCustomers}: ${brand.target_customers}` : ''}
${brand?.differentiators ? `\n${ai.differentiators}: ${brand.differentiators}` : ''}

${conversationOutcome === 'cancelled'
  ? `## Estado de la conversación
Esta conversación está CANCELADA. El cliente ya no quiere el producto.
ESTÁ PROHIBIDO mencionar pedidos, productos, precios, descuentos o procesos de compra.
NO uses el catálogo de productos ni las reglas de venta.
Responde SOLO con ayuda general, de forma amable y servicial.
Si el cliente pregunta por su pedido cancelado, confirma que fue cancelado y ofrece ayuda con otra cosa.`
  : `## ${ai.products}
${formatProducts(products, ai)}

## ${ai.salesRules}
${formatRules(rules, ai)}`
}
${formatInstructions(instructions) ? `\n## ${ai.additionalInstructions}\n${formatInstructions(instructions)}` : ''}
${formatKnowledge(knowledge, ai, landingContext?.productId, channel) ? `\n## ${ai.additionalKnowledge}\n${formatKnowledge(knowledge, ai, landingContext?.productId, channel)}` : ''}
${memory && memory.length > 0 ? `\n## ${ai.businessMemory}\n${formatBusinessMemory(memory, ai)}` : ''}
${customerMemory ? `\n## ${ai.customerMemory}\n${customerMemory}` : ''}
${formatLessons(recentLessons ?? [], ai) ? `\n## ${ai.whatIveLearned}\n${ai.lastCorrections}\n${formatLessons(recentLessons ?? [], ai)}` : ''}
${experienceContext ? `\n## Experiencia de Ventas\nUsa estas respuestas probadas como guía cuando el cliente plantee objeciones similares. Puedes adaptar el texto al contexto de la conversación, pero mantén la esencia de la respuesta recomendada:\n${experienceContext}` : ''}
${stateGuidance ? `\n${stateGuidance.state_section}\n## Guía de Acciones\nPermitidas: ${stateGuidance.permitted_actions.join(', ')}\nProhibidas: ${stateGuidance.prohibited_actions.join(', ')}\n\n${stateGuidance.guidance}` : ''}
${cancellationContext && conversationOutcome !== 'cancelled'
  ? `\n## Contexto importante
Este cliente canceló recientemente el pedido ${cancellationContext.orderNumber} (hace ${cancellationContext.hoursAgo} horas).
Ese pedido fue CANCELADO y YA NO EXISTE: está cerrado definitivamente y NUNCA debe confirmarse, re-confirmarse, retomarse ni mencionarse como pendiente.
PROHIBIDO preguntar por la confirmación de ese pedido o de sus productos (ej. "¿te confirmo tu pedido de X?"): aunque el cliente diga "sí", "dale" o "confirmo", NO aplica a ese pedido cancelado.
Si el cliente quiere comprar de nuevo (el mismo u otro producto), es una venta NUEVA desde cero: presenta el catálogo, pide confirmación SOLO sobre la compra nueva que él mencione, y nunca reutilices los datos del pedido cancelado como si fuera un pedido en curso.
NO menciones la cancelación a menos que el cliente lo pregunte directamente.`
  : ''}
${lastCancelledOrder && conversationOutcome !== 'cancelled'
  ? (lastCancelledOrder.pending
    // RETENTION_PENDING: discount offered, cancellation not yet confirmed
    ? (userIntent === 'casual'
      ? `\n## Estado de cancelación pendiente
El cliente solicitó cancelar una venta de ${lastCancelledOrder.productName ?? 'un producto'} hace ${lastCancelledOrder.hoursAgo} horas, pero la cancelación AÚN NO está confirmada. Se le ofreció un descuento y está decidiendo.

REGLA CRÍTICA: Los datos personales del cliente (nombre, teléfono, dirección) y el catálogo de productos NO constituyen intención de compra.

NO reconstruyas, propongas ni confirmes la venta pendiente de cancelación.
NO asumas que el cliente quiere comprar solo porque sus datos aparecen en el contexto.
Si el cliente no expresa una intención explícita de compra (mencionando un producto con "quiero", "comprar", "llevar", etc.), responde de manera general y NO inicies una venta.
Puedes responder preguntas sobre productos normalmente, pero NO presentes pedidos pendientes.`
      : userIntent === 'order_reference'
        ? `\n## Referencia a pedido con cancelación pendiente
El cliente menciona un pedido cuya cancelación está pendiente (${lastCancelledOrder.productName ?? 'producto'}).

Puedes explicar que el pedido está en proceso de verificación.
NO interpretes la mención como una nueva intención de compra.
NO re abras ni reconstruyas el pedido.
Si el cliente quiere comprar de nuevo, debe expresarlo explícitamente con una frase de compra ("quiero comprar", "quiero pedir", etc.).`
        : userIntent === 'explicit_purchase'
          ? `\n## Nueva venta iniciada
El cliente está iniciando una NUEVA venta de forma explícita, mientras tiene un pedido con cancelación pendiente.

NO reutilices ni reconstruyas el pedido con cancelación pendiente (${lastCancelledOrder.productName ?? 'producto'}).
Utiliza únicamente la intención actual del cliente para iniciar el nuevo flujo de venta.
Trata esta como una compra completamente nueva desde cero.
Nunca mezcles datos del pedido pendiente con la nueva venta.`
          : '')
    // CANCELLED: cancellation confirmed
    : (userIntent === 'casual'
      ? `\n## Guardia de venta cancelada
El cliente canceló recientemente una venta de ${lastCancelledOrder.productName ?? 'un producto'} (hace ${lastCancelledOrder.hoursAgo} horas).

REGLA CRÍTICA: Los datos personales del cliente (nombre, teléfono, dirección) y el catálogo de productos NO constituyen intención de compra.

NO reconstruyas, propongas ni confirmes la venta cancelada anterior.
NO asumas que el cliente quiere comprar solo porque sus datos aparecen en el contexto.
Si el cliente no expresa una intención explícita de compra (mencionando un producto con "quiero", "comprar", "llevar", etc.), responde de manera general y NO inicies una venta.
Saluda, ayuda con preguntas generales, pero NO presentes pedidos pendientes.`
      : userIntent === 'order_reference'
        ? `\n## Referencia a pedido cancelado
El cliente menciona un pedido que fue cancelado (${lastCancelledOrder.productName ?? 'producto'}).

Puedes explicar que el pedido fue cancelado y su estado actual.
NO interpretes la mención como una nueva intención de compra.
NO re abras ni reconstruyas el pedido cancelado.
Si el cliente quiere comprar de nuevo, debe expresarlo explícitamente con una frase de compra ("quiero comprar", "quiero pedir", etc.).`
        : userIntent === 'explicit_purchase'
          ? `\n## Nueva venta iniciada
El cliente está iniciando una NUEVA venta de forma explícita.

NO reutilices ni reconstruyas la venta cancelada anterior (${lastCancelledOrder.productName ?? 'producto'}).
Utiliza únicamente la intención actual del cliente para iniciar el nuevo flujo de venta.
Trata esta como una compra completamente nueva desde cero.
Nunca mezcles datos del pedido cancelado con la nueva venta.`
          : ''))
  : ''}
${capabilities?.active.has('MOD_INVENTORY') ? `\n## Inventario
Tienes acceso al sistema de inventario. Cuando el cliente pregunte por disponibilidad o stock de un producto, puedes consultar el inventario actual para dar una respuesta precisa. Si un producto no tiene stock, sugiere alternativas similares o informa al cliente que puede esperar reposición.` : ''}
${capabilities?.active.has('MOD_DELIVERY') ? `\n## Logística
Tienes acceso al sistema de entregas. Cuando el cliente pregunte por envíos o tiempos de entrega, puedes utilizar la información de rutas y repartidores para dar una respuesta más precisa sobre disponibilidad y tiempos estimados.` : ''}

## ${ai.finalInstruction}
${ai.finalInstructionText}`
}
