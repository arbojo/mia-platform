import { createAdminClient } from '@/lib/supabase/admin'
import { triggerMatches, intentMatchesTrigger } from './media'
import type { Database } from '@/lib/types'

type KnowledgeItem = Database['public']['Tables']['knowledge_items']['Row']

export interface MediaAttachment {
  knowledgeItemId: string
  imageUrl: string
  mediaType: 'image' | 'testimonial' | 'flyer' | 'other'
}

export async function resolveConditionalMedia(params: {
  businessId: string
  customerId: string
  conversationId: string | null
  userMessage: string
  intentTag?: string | null
  productId?: string | null
}): Promise<MediaAttachment | null> {
  const { businessId, customerId, conversationId, userMessage, intentTag, productId } = params
  if (!conversationId) return null

  const supabase = createAdminClient()

  const { data: candidates } = await supabase
    .from('knowledge_items')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .not('image_url', 'is', null)
    .not('trigger_condition', 'is', null)

  const matches = (item: KnowledgeItem): boolean => {
    if (!item.trigger_condition) return false
    if (triggerMatches(userMessage, item.trigger_condition)) return true
    if (intentTag && intentMatchesTrigger(intentTag, item.trigger_condition)) return true
    return false
  }

  const matching = (candidates ?? []).filter(matches)

  if (matching.length === 0) return null

  const { data: dispatched } = await supabase
    .from('chat_media_dispatched')
    .select('knowledge_item_id')
    .eq('conversation_id', conversationId)

  const dispatchedIds = new Set((dispatched ?? []).map((d) => d.knowledge_item_id))
  const pending = matching.filter((item) => !dispatchedIds.has(item.id))

  if (pending.length === 0) return null

  // Prioridad de producto: medio del producto activo > medio genérico (NULL).
  // El product_context elimina la ambigüedad de keywords compartidas
  // (ej. "precio" pertenece a varios productos).
  const byProduct = productId
    ? pending.find((item) => item.product_id === productId) ??
      pending.find((item) => item.product_id === null)
    : pending.find((item) => item.product_id === null)

  const selected = byProduct ?? pending[0]
  if (!selected?.image_url) return null

  try {
    await supabase.from('chat_media_dispatched').insert({
      business_id: businessId,
      conversation_id: conversationId,
      customer_id: customerId,
      knowledge_item_id: selected.id,
    })
  } catch (err) {
    console.error('Failed to record dispatched media:', err)
  }

  return {
    knowledgeItemId: selected.id,
    imageUrl: selected.image_url,
    mediaType: selected.media_type ?? 'other',
  }
}
