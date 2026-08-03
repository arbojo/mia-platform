import { createAdminClient } from '@/lib/supabase/admin'
import type { WireMessage } from '@/lib/runtime/types'

export class RuntimeError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'RuntimeError'
  }
}

export async function resolveConnection(
  channel: string,
  wireMessage: WireMessage
): Promise<{ business_id: string; assistant_id: string; mode: 'active' | 'shadow' | 'paused' }> {
  const metadata = wireMessage.metadata

  if (metadata.businessId) {
    const supabase = createAdminClient()
    const { data: assistant } = await supabase
      .from('assistants')
      .select('id, business_id')
      .eq('business_id', metadata.businessId as string)
      .eq('is_active', true)
      .limit(1)
      .single()

    if (assistant) {
      const mode = await resolveConnectionMode(supabase, assistant.business_id, channel)
      return { business_id: assistant.business_id, assistant_id: assistant.id, mode }
    }
    throw new RuntimeError('No active assistant found for business', 'NO_ASSISTANT', 404)
  }

  if (channel === 'whatsapp' && metadata.phoneNumberId) {
    const supabase = createAdminClient()
    const { data: connection } = await supabase
      .from('channel_connections')
      .select('business_id, assistant_id, mode')
      .eq('channel', 'whatsapp')
      .eq('status', 'connected')
      .contains('credentials', { phone_number_id: metadata.phoneNumberId as string })
      .limit(1)
      .single()

    if (connection) {
      return {
        business_id: connection.business_id,
        assistant_id: connection.assistant_id,
        mode: connection.mode ?? 'active',
      }
    }
  }

  throw new RuntimeError(
    `Cannot resolve connection for ${channel} channel. Ensure channel_connections is configured.`,
    'CONNECTION_NOT_FOUND',
    400
  )
}

async function resolveConnectionMode(
  supabase: ReturnType<typeof createAdminClient>,
  businessId: string,
  channel: string
): Promise<'active' | 'shadow' | 'paused'> {
  const { data: connection } = await supabase
    .from('channel_connections')
    .select('mode')
    .eq('business_id', businessId)
    .eq('channel', channel)
    .limit(1)
    .maybeSingle()

  return connection?.mode ?? 'active'
}

export async function resolveConversation(
  assistantId: string,
  customerId: string
): Promise<string | null> {
  const supabase = createAdminClient()

  const { data: existingConversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('assistant_id', assistantId)
    .eq('customer_id', customerId)
    .eq('status', 'active')
    .eq('type', 'live')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (existingConversation) {
    return existingConversation.id
  }

  const { data: newConversation } = await supabase
    .from('conversations')
    .insert({
      assistant_id: assistantId,
      customer_id: customerId,
      type: 'live',
      status: 'active',
    })
    .select()
    .single()

  return newConversation?.id ?? null
}
