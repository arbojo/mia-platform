import { createAdminClient } from '@/lib/supabase/admin'
import { resolveCanonicalProductId } from '@/lib/sales/canonical-product'
import type { Database } from '@/lib/types'

type SalesEventType = Database['public']['Tables']['sales_events']['Row']['event_type']
type ConversationOutcome = NonNullable<Database['public']['Tables']['conversations']['Row']['outcome']>

export interface DetectedSaleEvent {
  type: SalesEventType
  productName?: string | null
  amount?: number | null
}

/**
 * H1 / ADR-030 — error tipado cuando la escritura de un SALE_CANCELLED choca con
 * un índice UNIQUE parcial (23505 unique_violation): otro request concurrente ya
 * reclamó el slot (oferta única / cancelación única por conversación). El motor
 * lo traduce a ACK determinista; NO es un error genérico de transporte.
 */
export class SalesEventConflictError extends Error {
  readonly code = '23505'
  constructor(
    readonly eventType: SalesEventType,
    readonly constraint: string | null,
    message: string
  ) {
    super(message)
    this.name = 'SalesEventConflictError'
  }
}

export function isRetentionConflictError(error: unknown): error is SalesEventConflictError {
  return error instanceof SalesEventConflictError
}

export async function emitSalesEvent(params: {
  businessId: string
  assistantId?: string | null
  conversationId?: string | null
  customerId?: string | null
  eventType: SalesEventType
  productName?: string | null
  productId?: string | null
  orderId?: string | null
  amount?: number | null
  channel?: string | null
  metadata?: Record<string, unknown>
}): Promise<string> {
  const supabase = createAdminClient()

  let productId: string | null
  // C1: bind the event to the Order when one owns it.
  // C4: resolve product via the CANONICAL resolver for critical persistence.
  //     NO ilike / fuzzy / substring as a persistence fallback. If a
  //     productName is provided without an explicit id, we resolve through
  //     the canonical resolver; ambiguity or no-match => NULL (NO PERSIST).
  if (params.productId) {
    productId = params.productId
  } else if (params.productName) {
    productId = await resolveCanonicalProductId({
      businessId: params.businessId,
      productId: null,
      name: params.productName,
    })
  } else {
    productId = null
  }

  const { data, error: salesEventError } = await supabase
    .from('sales_events')
    .insert({
      business_id: params.businessId,
      assistant_id: params.assistantId ?? null,
      conversation_id: params.conversationId ?? null,
      customer_id: params.customerId ?? null,
      // Guard TASK-20260908: order_id solo se persiste cuando C1 lo provee
      // (columna existe tras aplicar 061_c1_sales_orders.sql al remote; hoy no
      // está → incluir el key rompe TODO insert a sales_events).
      ...(params.orderId ? { order_id: params.orderId } : {}),
      event_type: params.eventType,
      product_id: productId,
      amount: params.amount ?? null,
      metadata: {
        ...(params.productName ? { product_name: params.productName } : {}),
        ...(params.channel ? { channel: params.channel } : {}),
        ...params.metadata,
      },
    })
    .select('id')
    .single()

  if (salesEventError) {
    if (salesEventError.code === '23505') {
      throw new SalesEventConflictError(
        params.eventType,
        (salesEventError as { constraint?: string | null }).constraint ?? null,
        `Sales event ${params.eventType} already exists: ${salesEventError.message}`
      )
    }
    throw new Error(`Failed to emit sales event ${params.eventType}: ${salesEventError.message}`)
  }

  // Return the id of the created event so callers can reference this exact row
  // (e.g. for id-scoped compensation) without affecting other events.
  return data?.id ?? ''
}

export async function hasClosingEvent(conversationId: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('sales_events')
    .select('id')
    .eq('conversation_id', conversationId)
    .in('event_type', ['SALE_WON', 'SALE_LOST', 'SALE_CANCELLED'])
    .limit(1)
    .maybeSingle()
  return Boolean(data)
}

export interface SaleCycleState {
  hasClosed: boolean
  /** Existe una venta en curso DESPUÉS del último cierre (SALE_STARTED/PRODUCT_SELECTED). */
  hasOpenCycle: boolean
}

/**
 * Estado del ciclo de venta de una conversación, en una sola consulta.
 *
 * Reemplaza el early-return anti-loop basado solo en hasClosingEvent: permite
 * recompra legítima (nuevo ciclo tras cierre) a la vez que blinda contra la
 * reconfirmación de un cierre anterior. Sin ningún evento de cierre, hasClosed
 * es false y hasOpenCycle refleja la existencia de una venta en curso estándar.
 */
export async function getSaleCycleState(conversationId: string): Promise<SaleCycleState> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('sales_events')
    .select('event_type, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(100)
  const events = data ?? []

  const closing = events.find(
    (e) => e.event_type === 'SALE_WON' || e.event_type === 'SALE_LOST' || e.event_type === 'SALE_CANCELLED'
  )
  if (!closing) {
    return {
      hasClosed: false,
      hasOpenCycle: events.some(
        (e) => e.event_type === 'SALE_STARTED' || e.event_type === 'PRODUCT_SELECTED'
      ),
    }
  }

  const closingTime = new Date(closing.created_at).getTime()
  return {
    hasClosed: true,
    hasOpenCycle: events.some(
      (e) =>
        (e.event_type === 'SALE_STARTED' || e.event_type === 'PRODUCT_SELECTED') &&
        new Date(e.created_at).getTime() > closingTime
    ),
  }
}

export async function emitDeliveryIssueSignal(params: {
  businessId: string
  conversationId: string
  customerId: string
  complaint: string
}): Promise<void> {
  const supabase = createAdminClient()

  // Idempotencia: si ya existe una señal NO resuelta de queja de entrega para
  // esta conversación, no duplicar. El chat sigue fluyendo normal de todos modos.
  const { data: existing } = await supabase
    .from('mia_signals')
    .select('id')
    .eq('source', 'sales-delivery-issue')
    .eq('status', 'pending')
    .contains('action_payload', { conversation_id: params.conversationId })
    .limit(1)
    .maybeSingle()
  if (existing) return

  let orderNumber: string | null = null
  try {
    const { data: order } = await supabase
      .schema('delivery')
      .from('orders')
      .select('order_number')
      .eq('conversation_id', params.conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    orderNumber = order?.order_number ?? null
  } catch {
    // schema delivery no disponible — se resuelve el # de pedido por SALE_WON
  }
  if (!orderNumber) {
    const { data: saleWon } = await supabase
      .from('sales_events')
      .select('id')
      .eq('conversation_id', params.conversationId)
      .eq('event_type', 'SALE_WON')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (saleWon) {
      orderNumber = await fetchOrderNumber(saleWon.id)
    }
  }

  const customer = await getCustomerData(params.customerId)
  const customerName = customer?.name?.trim() || 'Cliente'
  const complaintPreview = params.complaint.trim().slice(0, 200)

  await supabase.from('mia_signals').insert({
    business_id: params.businessId,
    type: 'CUSTOMER',
    priority: 'atencion',
    title: orderNumber ? `Entrega no recibida — ${orderNumber}` : 'Entrega no recibida',
    message: `${customerName} reporta que no recibió su pedido${orderNumber ? ` ${orderNumber}` : ''}. Queja: “${complaintPreview}”.`,
    source: 'sales-delivery-issue',
    status: 'pending',
    action_available: 'open_conversation',
    action_payload: {
      conversation_id: params.conversationId,
      order_number: orderNumber,
      complaint: complaintPreview,
    },
  })
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

  const { error: outcomeError } = await supabase
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

  if (outcomeError) {
    throw new Error(`Failed to persist conversation outcome: ${outcomeError.message}`)
  }

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
      const { error: customerError } = await supabase
        .from('customers')
        .update({ status: customerStatus })
        .eq('id', customerId)
      if (customerError) {
        throw new Error(`Failed to sync customer status from outcome: ${customerError.message}`)
      }
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
