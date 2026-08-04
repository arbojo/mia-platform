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
}): Promise<MediaAttachment | null> {
  const { businessId, customerId, conversationId, userMessage, intentTag } = params
  if (!conversationId) return null

  const supabase = createAdminClient()

  const { data: candidates } = await supabase
    .from('knowledge_items')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .not('image_url', 'is', null)
    .not('trigger_condition', 'is', null)

  const matching = (candidates ?? []).filter((item: KnowledgeItem) => {
    if (!item.trigger_condition) return false
    if (triggerMatches(userMessage, item.trigger_condition)) return true
    if (intentTag && intentMatchesTrigger(intentTag, item.trigger_condition)) return true
    return false
  })

  if (matching.length === 0) return null

  const { data: dispatched } = await supabase
    .from('chat_media_dispatched')
    .select('knowledge_item_id')
    .eq('conversation_id', conversationId)

  const dispatchedIds = new Set((dispatched ?? []).map((d) => d.knowledge_item_id))

  const pending = matching.find((item) => !dispatchedIds.has(item.id))
  if (!pending?.image_url) return null

  try {
    await supabase.from('chat_media_dispatched').insert({
      business_id: businessId,
      conversation_id: conversationId,
      customer_id: customerId,
      knowledge_item_id: pending.id,
    })
  } catch (err) {
    console.error('Failed to record dispatched media:', err)
  }

  return {
    knowledgeItemId: pending.id,
    imageUrl: pending.image_url,
    mediaType: pending.media_type ?? 'other',
  }
}
