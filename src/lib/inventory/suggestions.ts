import { createInventoryAdmin } from './db'
import { createAdminClient } from '@/lib/supabase/admin'
import { InventoryError } from './errors'
import { getInventorySettings } from './licensing'
import { getStockOverview } from './stock'
import { buildRestockReason } from './rules'
import type { RestockSuggestionWithProduct } from './types'

export async function listSuggestions(businessId: string): Promise<RestockSuggestionWithProduct[]> {
  const supabase = createInventoryAdmin()
  const pub = createAdminClient()

  const { data: suggestions, error } = await supabase
    .from('restock_suggestions')
    .select('*')
    .eq('business_id', businessId)
    .order('generated_at', { ascending: false })
    .limit(200)

  if (error) throw error

  const rows = (suggestions ?? []) as Array<Record<string, unknown>>
  const productIds = [...new Set(rows.map((r) => r.product_id as string))]

  if (productIds.length === 0) return []

  const { data: products, error: productError } = await pub
    .from('products')
    .select('id, name, sku')
    .in('id', productIds)

  if (productError) throw productError

  const byId = new Map<string, { name: string; sku: string | null }>()
  for (const p of (products ?? []) as Array<{ id: string; name: string; sku: string | null }>) {
    byId.set(p.id, { name: p.name, sku: p.sku })
  }

  return rows.map((row) => ({
    ...(row as unknown as RestockSuggestionWithProduct),
    product_name: byId.get(row.product_id as string)?.name ?? 'Producto',
    sku: byId.get(row.product_id as string)?.sku ?? null,
  }))
}

export async function generateSuggestions(businessId: string): Promise<{ created: number; refreshed: number }> {
  const supabase = createInventoryAdmin()
  const settings = (await getInventorySettings(businessId)) as {
    default_low_stock_threshold: number
    lead_time_days: number
  } | null

  const leadTimeDays = settings?.lead_time_days ?? 3
  const defaultThreshold = settings?.default_low_stock_threshold ?? 5

  const { items } = await getStockOverview(businessId)

  const { data: existing } = await supabase
    .from('restock_suggestions')
    .select('product_id')
    .eq('business_id', businessId)
    .eq('status', 'pending')

  const pendingIds = new Set((existing ?? []).map((r) => r.product_id as string))

  let created = 0
  let refreshed = 0

  for (const item of items) {
    if (item.status === 'ok') continue
    const threshold = item.low_stock_threshold > 0 ? item.low_stock_threshold : defaultThreshold
    const reason = buildRestockReason({
      quantity: item.quantity,
      threshold,
      daysOut: item.daysOut,
      velocity7d: item.velocity7d,
      velocity30d: item.velocity30d,
      leadTimeDays,
    })

    const payload = {
      business_id: businessId,
      product_id: item.product_id,
      current_quantity: item.quantity,
      low_stock_threshold: threshold,
      suggested_qty: reason.suggested_qty,
      reason,
      updated_at: new Date().toISOString(),
    }

    if (pendingIds.has(item.product_id)) {
      const { error } = await supabase
        .from('restock_suggestions')
        .update(payload)
        .eq('business_id', businessId)
        .eq('product_id', item.product_id)
        .eq('status', 'pending')
      if (error) throw error
      refreshed++
    } else {
      const { error } = await supabase
        .from('restock_suggestions')
        .insert({ ...payload, status: 'pending', ai_used: false, tokens_used: 0 })
      if (error) throw error
      created++
    }
  }

  return { created, refreshed }
}

export async function setSuggestionStatus(
  businessId: string,
  suggestionId: string,
  status: 'dismissed' | 'done'
): Promise<void> {
  const supabase = createInventoryAdmin()

  const { data: existing, error } = await supabase
    .from('restock_suggestions')
    .select('id')
    .eq('id', suggestionId)
    .eq('business_id', businessId)
    .maybeSingle()

  if (error) throw error
  if (!existing) {
    throw new InventoryError('NOT_FOUND', 'Sugerencia no encontrada', 404)
  }

  const { error: updateError } = await supabase
    .from('restock_suggestions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', suggestionId)
    .eq('business_id', businessId)

  if (updateError) throw updateError
}
