import { createAdminClient } from '@/lib/supabase/admin'
import { triggerMatches, intentMatchesTrigger } from './media'
import { isSafeMediaUrl, getConversationMediaSentProducts, addConversationMediaSentProduct } from './media-guard'
import type { Database } from '@/lib/types'

type KnowledgeItem = Database['public']['Tables']['knowledge_items']['Row']

export interface MediaAttachment {
  knowledgeItemId: string
  imageUrl: string
  mediaType: 'image' | 'testimonial'
}

export async function resolveConditionalMedia(params: {
  businessId: string
  customerId?: string
  conversationId: string | null
  userMessage: string
  intentTag?: string | null
  productId?: string | null
  isResend?: boolean
}): Promise<MediaAttachment | null> {
  const { businessId, customerId, conversationId, userMessage, intentTag, productId, isResend } = params
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

  // Envío único por knowledge item: salvo que el cliente pida explícitamente
  // que se reenvíe la imagen (isResend), cada imagen se despacha una sola vez.
  let pending = matching
  if (!isResend) {
    const { data: dispatched } = await supabase
      .from('chat_media_dispatched')
      .select('knowledge_item_id')
      .eq('conversation_id', conversationId)

    const dispatchedIds = new Set((dispatched ?? []).map((d) => d.knowledge_item_id))
    pending = matching.filter((item) => !dispatchedIds.has(item.id))

    if (pending.length === 0) return null
  }

  // Prioridad de producto: cuando el productId es conocido, SOLO servimos
  // imagen de ese producto. NUNCA caemos a genéricos (product_id = NULL)
  // porque podrían pertenecer a otro producto (ej. imagen de Neurotin
  // apareciendo cuando el cliente pregunta por Clean Nails).
  const byProduct = productId
    ? pending.find((item) => item.product_id === productId)
    : pending.find((item) => item.product_id === null)

  const selected = byProduct ?? (productId ? null : pending[0])
  if (!selected?.image_url) return null

  // Envío único por PRODUCTO/sesión: si la imagen de este producto ya se
  // mostró en esta conversación, se omite la imagen (solo texto), salvo
  // re-pedido explícito del cliente.
  if (selected.product_id && !isResend) {
    const sentProducts = await getConversationMediaSentProducts(supabase, conversationId)
    if (sentProducts.includes(selected.product_id)) return null
  }

  // Blindaje de URL: solo media absoluta y pública (Supabase Storage/CDN).
  if (!isSafeMediaUrl(selected.image_url)) {
    console.warn(
      `[conditional-media] image_url no segura omitida (knowledge_item=${selected.id}): ${selected.image_url}`
    )
    return null
  }

  // Reclamo atómico del despacho contra uq_chat_media_once (migración 016):
  // ignoreDuplicates convierte la violación de unicidad en data vacía, así dos
  // ejecuciones concurrentes no pueden ambas "ganar" el envío normal y un
  // perdedor se degrada a null en vez de tumbar la respuesta con un throw.
  const { data: claimed, error } = await supabase
    .from('chat_media_dispatched')
    .upsert(
      {
        business_id: businessId,
        conversation_id: conversationId,
        ...(customerId ? { customer_id: customerId } : {}),
        knowledge_item_id: selected.id,
      },
      { onConflict: 'knowledge_item_id,conversation_id', ignoreDuplicates: true }
    )
    .select('knowledge_item_id')

  if (error) {
    console.error('Failed to record dispatched media:', error)
    throw error
  }

  // data vacía => otra ejecución ya despachó este item en esta conversación.
  // El reenvío explícito (isResend) entrega siempre sin duplicar la fila.
  if (!isResend && (!claimed || claimed.length === 0)) {
    return null
  }

  if (selected.product_id && !isResend) {
    await addConversationMediaSentProduct(
      supabase,
      conversationId,
      selected.product_id
    )
  }

  return {
    knowledgeItemId: selected.id,
    imageUrl: selected.image_url,
    mediaType: selected.media_type ?? 'image',
  }
}
