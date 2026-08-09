import { createInventoryAdmin } from './db'
import { InventoryError } from './errors'
import type { MovementType } from './types'

export function applyDelta(quantity: number, delta: number): number | null {
  const next = quantity + delta
  return next >= 0 ? next : null
}

export interface AdjustmentInput {
  businessId: string
  productId: string
  delta: number
  movementType: MovementType
  reason: string
  actorId: string
  expectedVersion?: number
}

export async function applyAdjustment(input: AdjustmentInput): Promise<{ newQuantity: number; version: number }> {
  if (input.delta === 0) {
    throw new InventoryError('INVALID_INPUT', 'El ajuste debe ser distinto de cero', 400)
  }

  const supabase = createInventoryAdmin()

  const { data: existing } = await supabase
    .from('stock_items')
    .select('*')
    .eq('business_id', input.businessId)
    .eq('product_id', input.productId)
    .maybeSingle()

  if (existing) {
    const expected = input.expectedVersion ?? existing.version
    if (expected !== existing.version) {
      throw new InventoryError(
        'STOCK_CONFLICT',
        'El stock cambió desde que cargaste la vista. Recargá y reintentá.',
        409
      )
    }

    const next = applyDelta(existing.quantity, input.delta)
    if (next === null) {
      throw new InventoryError(
        'INVALID_INPUT',
        'El ajuste dejaría el stock en negativo',
        400
      )
    }

    const { data, error } = await supabase
      .from('stock_items')
      .update({ quantity: next, version: existing.version + 1, updated_at: new Date().toISOString() })
      .eq('business_id', input.businessId)
      .eq('product_id', input.productId)
      .eq('version', expected)
      .select('*')
      .single()

    if (error) {
      throw new InventoryError('STOCK_CONFLICT', 'Conflicto de concurrencia al guardar', 409)
    }

    await recordMovement(input, input.delta, 'adjustment')
    await recordAudit(input, 'adjust_stock', data)
    return { newQuantity: data.quantity, version: data.version }
  }

  if (input.delta < 0) {
    throw new InventoryError('INVALID_INPUT', 'No existe stock para ajustar en negativo', 400)
  }

  const { data, error } = await supabase
    .from('stock_items')
    .upsert({
      business_id: input.businessId,
      product_id: input.productId,
      quantity: input.delta,
      low_stock_threshold: 5,
      version: 1,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  await recordMovement(input, input.delta, 'adjustment')
  await recordAudit(input, 'adjust_stock', data)
  return { newQuantity: data.quantity, version: data.version }
}

async function recordMovement(input: AdjustmentInput, delta: number, type: MovementType): Promise<void> {
  const supabase = createInventoryAdmin()
  const { error } = await supabase.from('stock_movements').insert({
    business_id: input.businessId,
    product_id: input.productId,
    quantity_delta: delta,
    movement_type: type,
    reason: input.reason || null,
    created_by: input.actorId || null,
  })
  if (error) throw error
}

async function recordAudit(input: AdjustmentInput, action: string, details: unknown): Promise<void> {
  const supabase = createInventoryAdmin()
  const { error } = await supabase.from('audit_log').insert({
    business_id: input.businessId,
    actor_type: 'user',
    actor_id: input.actorId || null,
    action,
    entity: 'stock_items',
    entity_id: input.productId,
    details: { product_id: input.productId, delta: input.delta, ...(details as Record<string, unknown>) },
  })
  if (error) throw error
}
