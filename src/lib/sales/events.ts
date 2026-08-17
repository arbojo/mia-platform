import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/types'

type SalesEventType = Database['public']['Tables']['sales_events']['Row']['event_type']
type ConversationOutcome = NonNullable<Database['public']['Tables']['conversations']['Row']['outcome']>

export interface DetectedSaleEvent {
  type: SalesEventType
  productName?: string | null
  amount?: number | null
}

export async function emitSalesEvent(params: {
  businessId: string
  assistantId?: string | null
  conversationId?: string | null
  customerId?: string | null
  eventType: SalesEventType
  productName?: string | null
  amount?: number | null
  metadata?: Record<string, unknown>
}): Promise<void> {
  const supabase = createAdminClient()

  let productId: string | null = null
  if (params.productName) {
    const { data: product } = await supabase
      .from('products')
      .select('id')
      .eq('business_id', params.businessId)
      .ilike('name', params.productName.trim())
      .limit(1)
      .maybeSingle()
    productId = product?.id ?? null
  }

  await supabase.from('sales_events').insert({
    business_id: params.businessId,
    assistant_id: params.assistantId ?? null,
    conversation_id: params.conversationId ?? null,
    customer_id: params.customerId ?? null,
    event_type: params.eventType,
    product_id: productId,
    amount: params.amount ?? null,
    metadata: {
      ...(params.productName ? { product_name: params.productName } : {}),
      ...params.metadata,
    },
  })
}

export async function hasClosingEvent(conversationId: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('sales_events')
    .select('id')
    .eq('conversation_id', conversationId)
    .in('event_type', ['SALE_WON', 'SALE_LOST'])
    .limit(1)
    .maybeSingle()
  return Boolean(data)
}

export async function applyConversationOutcome(params: {
  conversationId: string
  outcome: ConversationOutcome
  dealValue?: number | null
  customerId?: string | null
  eventType?: SalesEventType
}): Promise<void> {
  const supabase = createAdminClient()

  const { data: current } = await supabase
    .from('conversations')
    .select('outcome, deal_value, outcome_history, customer_id')
    .eq('id', params.conversationId)
    .maybeSingle()

  const customerId = params.customerId ?? current?.customer_id ?? null
  const prevOutcome = current?.outcome ?? null

  if (prevOutcome === 'sold' && params.outcome === 'sold') {
    return
  }

  const history = Array.isArray(current?.outcome_history) ? current.outcome_history : []

  await supabase
    .from('conversations')
    .update({
      outcome: params.outcome,
      deal_value: params.dealValue ?? current?.deal_value ?? null,
      outcome_updated_at: new Date().toISOString(),
      outcome_history: [
        ...history,
        {
          outcome: params.outcome,
          previous: prevOutcome,
          event_type: params.eventType ?? null,
          deal_value: params.dealValue ?? current?.deal_value ?? null,
          at: new Date().toISOString(),
        },
      ],
    })
    .eq('id', params.conversationId)

  if (customerId) {
    const customerStatus =
      params.outcome === 'sold'
        ? 'converted'
        : params.outcome === 'interested' || params.outcome === 'needs_follow_up'
          ? 'interested'
          : params.outcome === 'not_interested'
            ? 'lost'
            : null

    if (customerStatus) {
      await supabase
        .from('customers')
        .update({ status: customerStatus })
        .eq('id', customerId)
    }
  }
}

export async function notifySaleToOwner(params: {
  businessId: string
  customerName?: string | null
  amount?: number | null
  productName?: string | null
  products?: Array<{ name: string; amount?: number | null }> | null
  phone?: string | null
  city?: string | null
  address?: string | null
  outcome: 'won' | 'lost' | 'interested'
  conversationId?: string | null
}): Promise<void> {
  const supabase = createAdminClient()
  const name = params.customerName?.trim() || 'Cliente'

  const title =
    params.outcome === 'won'
      ? 'Nuevo pedido confirmado'
      : params.outcome === 'interested'
        ? 'Cliente interesado'
        : 'Venta perdida'

  const items = (params.products?.length ? params.products : params.productName ? [{ name: params.productName, amount: params.amount }] : [])
    .map((p) => `• ${p.name}${p.amount ? ` — $${p.amount}` : ''}`)
    .join('\n')

  const contactLine =
    params.phone || params.address || params.city
      ? `\n📱 ${params.phone || 'Sin teléfono'}${params.city ? ` · ${params.city}` : ''}${params.address ? `\n📍 ${params.address}` : ''}`
      : ''

  const message =
    params.outcome === 'won'
      ? `${name} confirmó un pedido${items ? `:\n${items}` : ''}${params.amount ? `\nTotal: $${params.amount}` : ''}${contactLine}${params.address ? '' : '\n📍 Pendiente de dirección'}`
      : params.outcome === 'interested'
        ? `${name} mostró interés${items ? ` en:\n${items}` : ''}. Requiere seguimiento.${contactLine}`
        : `${name} descartó la compra${params.productName ? ` de ${params.productName}` : ''}.`

  await supabase.from('mia_signals').insert({
    business_id: params.businessId,
    type: 'SALES',
    priority: params.outcome === 'won' ? 'atencion' : 'info',
    title,
    message,
    source: 'sales-closing',
    status: 'pending',
    action_available: params.conversationId ? 'open_conversation' : null,
    action_payload: {
      conversation_id: params.conversationId ?? null,
      outcome: params.outcome,
      delivery_pending: params.outcome === 'won' && !params.address,
      customer: {
        name: params.customerName ?? null,
        phone: params.phone ?? null,
        city: params.city ?? null,
        address: params.address ?? null,
      },
      products: items
        ? (params.products?.length ? params.products : params.productName ? [{ name: params.productName, amount: params.amount }] : [])
        : [],
      amount: params.amount ?? null,
    },
  })
}

export async function getCustomerName(customerId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('customers')
    .select('name')
    .eq('id', customerId)
    .maybeSingle()
  return data?.name ?? null
}

export async function getCustomerData(customerId: string): Promise<{
  name: string | null
  phone: string | null
  city: string | null
  address: string | null
} | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('customers')
    .select('name, phone, city, address')
    .eq('id', customerId)
    .maybeSingle()
  return data
    ? { name: data.name, phone: data.phone, city: data.city, address: data.address }
    : null
}

export async function fetchOrderNumber(saleEventId: string): Promise<string> {
  const supabase = createAdminClient()

  try {
    const { data } = await supabase
      .schema('delivery')
      .from('orders')
      .select('order_number')
      .eq('sales_event_id', saleEventId)
      .single()
    if (data?.order_number) return data.order_number
  } catch {
    // Delivery schema not available or no order — use fallback
  }

  return `VTA-${saleEventId.slice(0, 6).toUpperCase()}`
}

export async function emitSaleConfirmed(params: {
  businessId: string
  assistantId?: string | null
  conversationId: string
  customerId?: string | null
  saleEventId: string
  orderNumber: string
  confirmationMessage: string
}): Promise<void> {
  await emitSalesEvent({
    businessId: params.businessId,
    assistantId: params.assistantId,
    conversationId: params.conversationId,
    customerId: params.customerId,
    eventType: 'SALE_CONFIRMED',
    metadata: {
      original_sale_event_id: params.saleEventId,
      order_number: params.orderNumber,
      confirmation_message: params.confirmationMessage,
    },
  })
}

export async function hasCancellationLock(conversationId: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('conversations')
    .select('sales_cancelled_at')
    .eq('id', conversationId)
    .maybeSingle()
  return Boolean(data?.sales_cancelled_at)
}
