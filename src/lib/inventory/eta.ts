import { createInventoryAdmin } from './db'
import { InventoryError } from './errors'
import type { DeliveryPromise, EtaResult, Transfer } from './types'

export interface CalcularEtaInput {
  assetId: string
  locationId: string
}

export interface EtaContext {
  localQty: number
  transitQty: number
  transitEtaDays: number | null
  purchaseQty: number
  purchaseEtaDays: number | null
  leadTimeDays: number
}

export function computeEta(context: EtaContext): EtaResult {
  if (context.localQty > 0) {
    return {
      source: 'local',
      eta_days: 0,
      available_qty: context.localQty,
      message: 'Disponible en el nodo destino',
      breakdown: {},
    }
  }

  if (context.transitQty > 0) {
    const etaDays = Math.max(context.transitEtaDays ?? 0, 0)
    return {
      source: 'transit',
      eta_days: etaDays,
      available_qty: context.transitQty,
      message: 'Stock en transito hacia el nodo',
      breakdown: { transit_qty: context.transitQty, eta_dias: etaDays },
    }
  }

  if (context.purchaseQty > 0) {
    const etaDays = Math.max(context.purchaseEtaDays ?? 0, 0)
    return {
      source: 'purchase',
      eta_days: etaDays,
      available_qty: context.purchaseQty,
      message: 'Reposicion externa en transito',
      breakdown: { po_qty: context.purchaseQty, eta_dias: etaDays },
    }
  }

  return {
    source: 'purchase',
    eta_days: context.leadTimeDays,
    available_qty: 0,
    message: 'Requiere reabastecimiento externo',
    breakdown: { lead_time_dias: context.leadTimeDays },
  }
}

export async function calcularEta(input: CalcularEtaInput): Promise<EtaResult> {
  const supabase = createInventoryAdmin()

  const { data, error } = await supabase.rpc('calcular_eta', {
    p_asset_id: input.assetId,
    p_location_id: input.locationId,
  })

  if (error) throw error

  const rows = (data ?? []) as unknown as EtaResult[]
  if (rows.length === 0) {
    return { source: 'unavailable', eta_days: null, available_qty: 0, message: 'Sin estimación', breakdown: {} }
  }

  return rows[0]
}

export interface DeliveryPromiseInput {
  businessId: string
  salesEventId: string | null
  deliveryOrderId: string | null
  promisedDeliveryDate: string
  originalAmount: number
  idempotencyKey: string
}

export async function createDeliveryPromise(
  input: DeliveryPromiseInput
): Promise<{ promise_id: string; promise_token: string; idempotent: boolean; discount_amount: number }> {
  const supabase = createInventoryAdmin()

  const { data, error } = await supabase.rpc('create_delivery_promise', {
    p_business_id: input.businessId,
    p_sales_event_id: input.salesEventId,
    p_delivery_order_id: input.deliveryOrderId,
    p_promised_delivery_date: input.promisedDeliveryDate,
    p_original_amount: input.originalAmount,
    p_idempotency_key: input.idempotencyKey,
  })

  if (error) throw error

  return (data ?? {}) as unknown as {
    promise_id: string
    promise_token: string
    idempotent: boolean
    discount_amount: number
  }
}

export async function listDeliveryPromises(businessId: string, status?: DeliveryPromise['status']): Promise<DeliveryPromise[]> {
  const supabase = createInventoryAdmin()

  let query = supabase
    .from('delivery_promises')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) throw error

  return (data ?? []) as unknown as DeliveryPromise[]
}

export interface ExecuteTransferInput {
  businessId: string
  fromLocationId: string
  toLocationId: string
  assetId: string
  qty: number
  estimatedArrival: string | null
  createdBy: string | null
}

export async function executeTransfer(
  input: ExecuteTransferInput
): Promise<{ transfer_id: string; transfer_number: string }> {
  const supabase = createInventoryAdmin()

  const { data, error } = await supabase.rpc('execute_transfer', {
    p_business_id: input.businessId,
    p_from_location_id: input.fromLocationId,
    p_to_location_id: input.toLocationId,
    p_asset_id: input.assetId,
    p_qty: input.qty,
    p_estimated_arrival: input.estimatedArrival,
    p_created_by: input.createdBy,
  })

  if (error) {
    if (typeof error.message === 'string' && /stock_insuficiente_en_origen/.test(error.message)) {
      throw new InventoryError('INVALID_INPUT', 'Stock insuficiente en el nodo origen', 400)
    }
    throw error
  }

  return (data ?? {}) as unknown as { transfer_id: string; transfer_number: string }
}

export async function completeTransfer(transferId: string, businessId: string): Promise<{ status: string }> {
  const supabase = createInventoryAdmin()

  const { data, error } = await supabase.rpc('complete_transfer', {
    p_transfer_id: transferId,
    p_business_id: businessId,
  })

  if (error) throw error

  return (data ?? {}) as unknown as { status: string }
}

export async function listTransfers(businessId: string): Promise<Transfer[]> {
  const supabase = createInventoryAdmin()

  const { data, error } = await supabase
    .from('transfers')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw error

  return (data ?? []) as unknown as Transfer[]
}
