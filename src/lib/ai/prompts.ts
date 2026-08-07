import type { Database } from '@/lib/types'
import { authorityTag } from '@/lib/ai/knowledge'
import type { Locale } from '@/lib/i18n/config'
import { DEFAULT_LOCALE } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'

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

function formatKnowledge(knowledge: KnowledgeItem[], ai: PromptDict): string {
  if (knowledge.length === 0) return ''

  return knowledge
    .map((k) => {
      const tag = authorityTag({ source: k.source, is_immutable: null, memory_type: null })
      const imageNote =
        k.image_url && k.trigger_condition
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
  channel?: 'web' | 'whatsapp' | 'messenger' | 'instagram' | 'widget'
  intentTag?: string | null
  landingContext?: {
    brand?: string
    product?: string
  }
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
    landingContext,
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

  return `${ai.youAre} ${assistant.name}, ${ai.salesAssistantOf} ${brand?.business_name ?? business.name}.

## ${ai.yourObjective}
${ai.objectiveText}

## ${ai.yourPersonality}
${ai.personalityStyle}: ${personalityLabel}

## ${ai.communicationStyle}
${ai.communicationStyleText} ${assistant.communication_style}.${toneNote}${channelNote}${landingNote}

## ${ai.fundamentalRules}
1. ${ai.neverInvent}
2. ${ai.ifUnsure}
3. ${ai.askCity}
4. ${ai.noDiscounts}
5. ${ai.humanHandoff}

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

## ${ai.businessInfo}
${brand?.elevator_pitch ?? ai.noBusinessInfo}
${brand?.target_customers ? `\n${ai.targetCustomers}: ${brand.target_customers}` : ''}
${brand?.differentiators ? `\n${ai.differentiators}: ${brand.differentiators}` : ''}

## ${ai.products}
${formatProducts(products, ai)}

## ${ai.salesRules}
${formatRules(rules, ai)}
${formatInstructions(instructions) ? `\n## ${ai.additionalInstructions}\n${formatInstructions(instructions)}` : ''}
${formatKnowledge(knowledge, ai) ? `\n## ${ai.additionalKnowledge}\n${formatKnowledge(knowledge, ai)}` : ''}
${memory && memory.length > 0 ? `\n## ${ai.businessMemory}\n${formatBusinessMemory(memory, ai)}` : ''}
${customerMemory ? `\n## ${ai.customerMemory}\n${customerMemory}` : ''}
${formatLessons(recentLessons ?? [], ai) ? `\n## ${ai.whatIveLearned}\n${ai.lastCorrections}\n${formatLessons(recentLessons ?? [], ai)}` : ''}

## ${ai.finalInstruction}
${ai.finalInstructionText}`
}
