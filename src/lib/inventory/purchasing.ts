import { createHmac, timingSafeEqual } from 'crypto'
import { createInventoryAdmin } from './db'
import { InventoryError } from './errors'
import type { PurchaseOrder, PurchaseOrderStatus, Supplier } from './types'

const HASH_LENGTH = 64

export function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  signatureHeader: string | null
): boolean {
  if (!signatureHeader) return false

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  if (expected.length !== HASH_LENGTH || signatureHeader.length !== HASH_LENGTH) return false

  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(signatureHeader, 'utf8')
  if (a.length !== b.length || a.length < 1 || a.length > 128) return false

  return timingSafeEqual(a, b)
}

export interface SupplierInput {
  name: string
  contactName?: string
  phone?: string
  email?: string
  leadTimeDays?: number
  leadTimeVarianceDays?: number
  supplierReliabilityScore?: number
  attributes?: Record<string, unknown>
  isActive?: boolean
}

export async function listSuppliers(businessId: string): Promise<Supplier[]> {
  const supabase = createInventoryAdmin()

  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('business_id', businessId)
    .order('name')

  if (error) throw error

  return (data ?? []) as unknown as Supplier[]
}

export async function upsertSupplier(businessId: string, input: SupplierInput): Promise<Supplier> {
  const supabase = createInventoryAdmin()

  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      business_id: businessId,
      name: input.name,
      contact_name: input.contactName ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      lead_time_days: input.leadTimeDays ?? 3,
      lead_time_variance_days: input.leadTimeVarianceDays ?? 0,
      supplier_reliability_score: input.supplierReliabilityScore ?? 0.9,
      attributes: input.attributes ?? {},
      is_active: input.isActive ?? true,
    })
    .select('*')
    .single()

  if (error) throw error

  return data as unknown as Supplier
}

export async function listPurchaseOrders(businessId: string, status?: PurchaseOrderStatus): Promise<PurchaseOrder[]> {
  const supabase = createInventoryAdmin()

  let query = supabase
    .from('purchase_orders')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) throw error

  return (data ?? []) as unknown as PurchaseOrder[]
}

export interface TransitionPoInput {
  businessId: string
  purchaseOrderId: string
  toStatus: PurchaseOrderStatus
  userId: string | null
  note?: string
}

export async function transitionPurchaseOrder(input: TransitionPoInput): Promise<{ from: string; to: string }> {
  const supabase = createInventoryAdmin()

  const { data, error } = await supabase.rpc('transition_purchase_order', {
    p_purchase_order_id: input.purchaseOrderId,
    p_business_id: input.businessId,
    p_to_status: input.toStatus,
    p_created_by: input.userId,
    p_note: input.note ?? null,
  })

  if (error) {
    if (typeof error.message === 'string' && /transicion_invalida/.test(error.message)) {
      throw new InventoryError('INVALID_INPUT', 'Transición de estado inválida para esta orden', 400)
    }
    throw error
  }

  return (data ?? {}) as unknown as { from: string; to: string }
}

export async function suggestBomProcurement(
  businessId: string,
  parentAssetId: string,
  projectedQty: number
): Promise<{ created: number }> {
  const supabase = createInventoryAdmin()

  const { data, error } = await supabase.rpc('suggest_bom_procurement', {
    p_business_id: businessId,
    p_parent_asset_id: parentAssetId,
    p_projected_qty: projectedQty,
  })

  if (error) throw error

  return (data ?? { created: 0 }) as unknown as { created: number }
}

export interface SupplierWebhookPayload {
  supplierId: string
  purchaseOrderId: string | null
  eventType: 'shipped' | 'in_transit' | 'received' | 'tracking_update'
  payload: Record<string, unknown>
}

export async function handleSupplierWebhook(
  businessId: string,
  input: SupplierWebhookPayload
): Promise<{ event_id: string; status: string }> {
  const supabase = createInventoryAdmin()

  const { data, error } = await supabase.rpc('handle_supplier_webhook', {
    p_business_id: businessId,
    p_supplier_id: input.supplierId,
    p_purchase_order_id: input.purchaseOrderId,
    p_event_type: input.eventType,
    p_payload: input.payload,
  })

  if (error) throw error

  return (data ?? {}) as unknown as { event_id: string; status: string }
}
