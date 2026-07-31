import { SupabaseClient } from '@supabase/supabase-js'

export interface ConversationRow {
  id: string
  customerName: string | null
  customerId: string | null
  type: 'training' | 'live' | 'simulation'
  status: 'active' | 'archived'
  lastMessage: string | null
  messageCount: number
  lastActivity: string | null
}

export interface ConversationDetailData {
  conversation: {
    id: string
    type: 'training' | 'live' | 'simulation'
    status: 'active' | 'archived'
    outcome: string | null
    deal_value: number | null
    potential_value: number | null
    created_at: string
    handover_reason: string | null
    assigned_to: string | null
  }
  customer: {
    id: string
    name: string | null
    phone: string | null
    email: string | null
    tags: string[]
    status: string
    city: string | null
    notes: string | null
    last_interaction: string | null
    created_at: string
  } | null
  messages: Array<{
    id: string
    role: string
    content: string
    created_at: string
    metadata: unknown
  }>
  memories: Array<{
    id: string
    memory_type: string
    content: string
    created_at: string
  }>
}

export async function getConversations(
  supabase: SupabaseClient,
  businessId: string,
  options?: {
    search?: string
    status?: 'active' | 'archived'
    type?: 'training' | 'live' | 'simulation'
    page?: number
    pageSize?: number
  }
): Promise<{ data: ConversationRow[]; total: number }> {
  const { search, status, type, page = 1, pageSize = 20 } = options ?? {}

  try {
    let query = supabase
      .from('conversations')
      .select(`
        id, type, status, created_at,
        customers!left(id, name),
        assistants!inner(business_id)
      `, { count: 'exact' })
      .eq('assistants.business_id', businessId)

    if (status) query = query.eq('status', status)
    if (type) query = query.eq('type', type)
    if (search) query = query.ilike('customers.name', `%${search}%`)

    const { data: conversations, count } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)

    if (!conversations || conversations.length === 0) {
      return { data: [], total: 0 }
    }

    const ids = conversations.map((c) => c.id)

    const { data: latestMessages } = await supabase
      .from('messages')
      .select('conversation_id, content, role, created_at')
      .in('conversation_id', ids)
      .order('created_at', { ascending: false })

    const messageMap = new Map<string, { content: string; created_at: string }>()
    const countMap = new Map<string, number>()
    if (latestMessages) {
      for (const msg of latestMessages) {
        if (!messageMap.has(msg.conversation_id)) {
          messageMap.set(msg.conversation_id, {
            content: msg.content,
            created_at: msg.created_at,
          })
        }
        countMap.set(
          msg.conversation_id,
          (countMap.get(msg.conversation_id) ?? 0) + 1
        )
      }
    }

    const data: ConversationRow[] = conversations.map((c) => {
      const last = messageMap.get(c.id)
      return {
        id: c.id,
        customerName: c.customers
          ? (c.customers as unknown as { name: string | null }).name
          : null,
        customerId: c.customers
          ? (c.customers as unknown as { id: string }).id
          : null,
        type: c.type,
        status: c.status,
        lastMessage: last?.content?.slice(0, 100) ?? null,
        messageCount: countMap.get(c.id) ?? 0,
        lastActivity: last?.created_at ?? c.created_at,
      }
    })

    return { data, total: count ?? 0 }
  } catch {
    return { data: [], total: 0 }
  }
}

export async function getConversationDetail(
  supabase: SupabaseClient,
  businessId: string,
  conversationId: string
): Promise<ConversationDetailData | null> {
  try {
    const { data: conv } = await supabase
      .from('conversations')
      .select(`
        id, type, status, outcome, deal_value, potential_value, created_at, handover_reason, assigned_to,
        customers!left(id, name, phone, email, city, tags, status, notes, last_interaction, created_at),
        assistants!inner(business_id)
      `)
      .eq('id', conversationId)
      .eq('assistants.business_id', businessId)
      .single()

    if (!conv) return null

    const assistantId = (conv.assistants as unknown as { id: string }).id
    const customerId = conv.customers
      ? (conv.customers as unknown as { id: string }).id
      : null

    const [{ data: messages }, { data: memories }] = await Promise.all([
      supabase
        .from('messages')
        .select('id, role, content, created_at, metadata')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true }),
      customerId
        ? supabase
            .from('assistant_memories')
            .select('id, memory_type, content, created_at')
            .eq('customer_id', customerId)
            .eq('assistant_id', assistantId)
            .order('created_at', { ascending: false })
        : { data: [] },
    ])

    return {
      conversation: {
        id: conv.id,
        type: conv.type,
        status: conv.status,
        outcome: conv.outcome,
        deal_value: conv.deal_value,
        potential_value: conv.potential_value,
        created_at: conv.created_at,
        handover_reason: conv.handover_reason,
        assigned_to: conv.assigned_to,
      },
      customer: conv.customers
        ? {
            id: (conv.customers as unknown as { id: string }).id,
            name: (conv.customers as unknown as { name: string | null }).name,
            phone: (conv.customers as unknown as { phone: string | null }).phone,
            email: (conv.customers as unknown as { email: string | null }).email,
            city: (conv.customers as unknown as { city: string | null }).city,
            tags: (conv.customers as unknown as { tags: string[] }).tags ?? [],
            status: (conv.customers as unknown as { status: string }).status,
            notes: (conv.customers as unknown as { notes: string | null }).notes,
            last_interaction:
              (conv.customers as unknown as { last_interaction: string | null })
                .last_interaction,
            created_at:
              (conv.customers as unknown as { created_at: string }).created_at,
          }
        : null,
      messages: messages ?? [],
      memories: memories ?? [],
    }
  } catch {
    return null
  }
}
