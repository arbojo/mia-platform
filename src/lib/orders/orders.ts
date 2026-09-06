import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveCanonicalProductId } from '@/lib/sales/canonical-product'

export type OrderDataQuality = 'complete' | 'legacy'

export interface OrderLineInput {
  productId?: string | null
  productName: string
  sku?: string | null
  unitPrice?: number | null
  originalPrice?: number | null
  discount?: number | null
  quantity: number
  variant?: Record<string, unknown> | null
}

/** Untyped admin client for the orders tables + RPCs not in the generated type. */
function createOrdersDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export interface CreateOrderParams {
  businessId: string
  assistantId?: string | null
  conversationId?: string | null
  customerId?: string | null
  customerSnapshot?: Record<string, unknown> | null
  channel?: string | null
  orderNumber?: string | null
  dataQuality?: OrderDataQuality
  amount?: number | null
  deliveryCost?: number | null
  createdBy?: string | null
  lines: OrderLineInput[]
}

export interface CreateOrderResult {
  orderId: string
}

/**
 * C1 — Create a Sales Order + its lines.
 * - conversation_id is stored as CONTEXT only (never identity).
 * - Each line's product_id must resolve via the canonical resolver (C4);
 *   if ambiguous/unresolved the line's product_id is left NULL (never a
 *   guessed/fuzzy id).
 * - SALE_WON is emitted idempotently by (business_id, order_id).
 */
export async function createSalesOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  const db = createOrdersDb()
  const dataQuality = params.dataQuality ?? 'complete'
  const state = dataQuality === 'legacy' ? 'cancelled' : 'draft'

  const { data: order, error: orderError } = await db
    .from('sales_orders')
    .insert({
      business_id: params.businessId,
      assistant_id: params.assistantId ?? null,
      conversation_id: params.conversationId ?? null,
      customer_id: params.customerId ?? null,
      order_number: params.orderNumber ?? null,
      state,
      amount: params.amount ?? null,
      delivery_cost: params.deliveryCost ?? 0,
      customer_snapshot: params.customerSnapshot ?? {},
      channel: params.channel ?? null,
      source: { created_by: params.createdBy ?? null },
      created_by: params.createdBy ?? null,
    })
    .select('id')
    .single()

  if (orderError || !order) {
    throw new Error(`Failed to create sales order: ${orderError?.message}`)
  }

  for (const line of params.lines) {
    const resolvedProductId = await resolveCanonicalProductId({
      businessId: params.businessId,
      productId: line.productId ?? null,
      sku: line.sku ?? null,
      name: line.productName,
    })

    const subtotal = (line.unitPrice ?? 0) * line.quantity

    await db.from('sales_order_lines').insert({
      order_id: order.id,
      product_id: resolvedProductId,
      product_name: line.productName,
      sku: line.sku ?? null,
      unit_price: line.unitPrice ?? null,
      original_price: line.originalPrice ?? null,
      discount: line.discount ?? 0,
      quantity: line.quantity,
      variant: line.variant ?? {},
      subtotal,
    })
  }

  return { orderId: order.id }
}

/**
 * C1 — Emit SALE_WON idempotently by (business_id, order_id).
 * Recompra en misma conversación permitida porque order_id != conversation_id.
 * Returns the event id, or null if already emitted (idempotent).
 */
export async function emitSaleWonForOrder(params: {
  businessId: string
  assistantId?: string | null
  conversationId?: string | null
  customerId?: string | null
  orderId: string
  productId?: string | null
  productName?: string | null
  amount?: number | null
  metadata?: Record<string, unknown>
}): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sales_events')
    .insert({
      business_id: params.businessId,
      assistant_id: params.assistantId ?? null,
      conversation_id: params.conversationId ?? null,
      customer_id: params.customerId ?? null,
      order_id: params.orderId,
      event_type: 'SALE_WON',
      product_id: params.productId ?? null,
      amount: params.amount ?? null,
      metadata: params.metadata ?? {},
    })
    .select('id')
    .single()

  if (error) {
    // 23505 = unique violation => SALE_WON already emitted for this order
    if (error.code === '23505') return null
    throw new Error(`Failed to emit SALE_WON: ${error.message}`)
  }
  return data?.id ?? null
}

export { resolveCanonicalProductId }
