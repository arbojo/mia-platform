import { createAdminClient } from '@/lib/supabase/admin'
import { getBusinessContext, getLandingContext, getRecentLessons, type LandingContext } from '@/lib/ai/knowledge'
import { buildMasterPrompt } from '@/lib/ai/prompts'
import { getCustomerMemory, formatCustomerMemoryForPrompt } from '@/lib/ai/customer-memory'
import { getProfileLanguage } from '@/lib/system/language'
import type { Locale } from '@/lib/i18n/config'
import type { ChannelType } from '@/lib/channels/types'

export class ContextError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'ContextError'
  }
}

export interface LoadedContext {
  systemPrompt: string
  usedContext: Array<{ type: string; id: string }>
  fullAssistant: unknown
  businessId: string
  assistantId: string
  customerId?: string
  productId?: string
}

const CACHE_TTL = 5 * 60 * 1000
const CUSTOMER_CACHE_TTL = 30 * 1000

interface CacheEntry {
  data: LoadedContext
  expiresAt: number
}

const contextCache = new Map<string, CacheEntry>()

async function getOwnerLocale(ownerId: string): Promise<Locale> {
  try {
    return await getProfileLanguage(ownerId)
  } catch (err) {
    console.error('Failed to load owner locale, falling back to default:', err)
    return 'es'
  }
}

function cacheKey(
  businessId: string,
  assistantId: string,
  customerId?: string,
  landingContext?: LandingContext
): string {
  const landing = landingContext
    ? `:landing:${landingContext.landingId}:${landingContext.brand ?? ''}:${landingContext.product ?? ''}`
    : ''
  return `${businessId}:${assistantId}:${customerId ?? ''}${landing}`
}

export async function loadConversationContext(
  businessId: string,
  assistantId: string,
  customerId?: string,
  channel?: ChannelType | 'simulation',
  intentTag?: string | null,
  landingContext?: LandingContext
): Promise<LoadedContext> {
  const key = `${cacheKey(businessId, assistantId, customerId, landingContext)}:${channel ?? 'default'}:${intentTag ?? ''}`
  const cached = contextCache.get(key)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data
  }

  const supabase = createAdminClient()

  const { data: fullAssistant } = await supabase
    .from('assistants')
    .select('*, businesses(*)')
    .eq('id', assistantId)
    .single()

  if (!fullAssistant) {
    throw new ContextError('Assistant not found', 'ASSISTANT_NOT_FOUND', 404)
  }

  const [context, recentLessons] = await Promise.all([
    landingContext ? getLandingContext(businessId, landingContext) : getBusinessContext(businessId),
    getRecentLessons(assistantId, 10),
  ])

  const productId = landingContext ? (context as { productId?: string }).productId : undefined

  let customerMemory: string | undefined
  if (customerId) {
    try {
      const memory = await getCustomerMemory(customerId)
      if (memory) {
        customerMemory = formatCustomerMemoryForPrompt(memory)
      }
    } catch (err) {
      console.error('Failed to load customer memory:', err)
    }
  }

  const systemPrompt = buildMasterPrompt({
    business: fullAssistant.businesses,
    brand: context.brand,
    assistant: fullAssistant,
    products: context.products,
    rules: context.rules,
    instructions: context.instructions,
    knowledge: context.knowledge,
    memory: context.memory,
    customerMemory,
    recentLessons,
    locale: await getOwnerLocale(fullAssistant.businesses.owner_id),
    channel,
    intentTag,
    landingContext,
    salesConfig: 'salesConfig' in context ? context.salesConfig : undefined,
  })

  const usedContext: Array<{ type: string; id: string }> = []
  context.products.forEach((p) => usedContext.push({ type: 'product', id: p.id }))
  context.rules.forEach((r) => usedContext.push({ type: 'sales_rule', id: r.id }))
  context.instructions.forEach((i) => usedContext.push({ type: 'ai_instruction', id: i.id }))
  context.knowledge.forEach((k) => usedContext.push({ type: 'knowledge_item', id: k.id }))
  if (context.memory) context.memory.forEach((m) => usedContext.push({ type: 'business_memory', id: m.id }))

  const result: LoadedContext = {
    systemPrompt,
    usedContext,
    fullAssistant,
    businessId,
    assistantId,
    customerId,
    productId,
  }

  const ttl = customerId ? CUSTOMER_CACHE_TTL : CACHE_TTL
  contextCache.set(key, { data: result, expiresAt: Date.now() + ttl })

  return result
}

export function clearContextCache(): void {
  contextCache.clear()
}

export function invalidateConversationContext(businessId: string): void {
  const prefix = `${businessId}:`
  for (const key of contextCache.keys()) {
    if (key.startsWith(prefix)) {
      contextCache.delete(key)
    }
  }
}
