import { createInventoryAdmin } from './db'
import { createAdminClient } from '@/lib/supabase/admin'
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
  const pub = createAdminClient()

  const { data: bridge } = await supabase
    .from('asset_products')
    .select('asset_id')
    .eq('business_id', input.businessId)
    .eq('product_id', input.productId)
    .limit(1)

  const assetId = bridge?.[0]?.asset_id as string | undefined

  if (assetId) {
    const { data: existing } = await supabase
      .from('assets')
      .select('*')
      .eq('business_id', input.businessId)
      .eq('id', assetId)
      .maybeSingle()

    if (!existing) {
      throw new InventoryError('NOT_FOUND', 'No existe el asset de inventario', 404)
    }

    const expected = input.expectedVersion ?? existing.version
    if (expected !== existing.version) {
      throw new InventoryError(
        'STOCK_CONFLICT',
        'El stock cambió desde que cargaste la vista. Recargá y reintentá.',
        409
      )
    }

    const next = applyDelta(existing.current_qty, input.delta)
    if (next === null) {
      throw new InventoryError('INVALID_INPUT', 'El ajuste dejaría el stock en negativo', 400)
    }

    const { data, error } = await supabase
      .from('assets')
      .update({ current_qty: next, version: existing.version + 1, updated_at: new Date().toISOString() })
      .eq('business_id', input.businessId)
      .eq('id', assetId)
      .eq('version', expected)
      .select('*')
      .single()

    if (error) {
      throw new InventoryError('STOCK_CONFLICT', 'Conflicto de concurrencia al guardar', 409)
    }

    await recordMovement(input, assetId, input.delta, 'adjustment')
    await recordAudit(input, assetId, 'adjust_stock', data)
    return { newQuantity: data.current_qty, version: data.version }
  }

  if (input.delta < 0) {
    throw new InventoryError('INVALID_INPUT', 'No existe stock para ajustar en negativo', 400)
  }

  const { data: product } = await pub
    .from('products')
    .select('id, name, sku')
    .eq('id', input.productId)
    .maybeSingle()

  if (!product) {
    throw new InventoryError('NOT_FOUND', 'El producto no existe en el catálogo', 404)
  }

  const { data, error } = await supabase
    .from('assets')
    .insert({
      business_id: input.businessId,
      item_type: 'sku',
      tracking_mode: 'quantity',
      code: product.sku ?? null,
      name: product.name,
      attributes: { product_id: input.productId },
      uom: 'u',
      lifecycle_state: 'active',
      current_qty: input.delta,
      min_qty: 5,
      version: 1,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  const { error: bridgeError } = await supabase.from('asset_products').insert({
    business_id: input.businessId,
    asset_id: data.id,
    product_id: input.productId,
  })
  if (bridgeError) throw bridgeError

  await recordMovement(input, data.id, input.delta, 'adjustment')
  await recordAudit(input, data.id, 'adjust_stock', data)
  return { newQuantity: data.current_qty, version: data.version }
}

async function recordMovement(input: AdjustmentInput, assetId: string, delta: number, type: MovementType): Promise<void> {
  const supabase = createInventoryAdmin()
  const { error } = await supabase.from('stock_movements').insert({
    business_id: input.businessId,
    product_id: input.productId,
    asset_id: assetId,
    quantity_delta: delta,
    movement_type: type,
    reason: input.reason || null,
    created_by: input.actorId || null,
  })
  if (error) throw error
}

async function recordAudit(input: AdjustmentInput, assetId: string, action: string, details: unknown): Promise<void> {
  const supabase = createInventoryAdmin()
  const { error } = await supabase.from('audit_log').insert({
    business_id: input.businessId,
    actor_type: 'user',
    actor_id: input.actorId || null,
    action,
    entity: 'assets',
    entity_id: assetId,
    details: { product_id: input.productId, asset_id: assetId, delta: input.delta, ...(details as Record<string, unknown>) },
  })
  if (error) throw error
}
