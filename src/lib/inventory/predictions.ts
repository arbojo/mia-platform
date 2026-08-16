import { createInventoryAdmin } from './db'
import { createAdminClient } from '@/lib/supabase/admin'
import { getInventorySettings } from './licensing'
import { unitsSoldInWindow } from './rules'
import { saleQuantities } from './stock'
import type { PredictionResult } from './types'

export type PredictionMode = 'minmax' | 'trend' | 'hybrid'

interface SettingsRow {
  vertical: string | null
  prediction_mode: PredictionMode | null
  lead_time_days: number | null
  default_low_stock_threshold: number | null
  default_min_qty: number | null
  default_max_qty: number | null
}

interface AssetRow {
  id: string
  business_id: string
  item_type: string
  tracking_mode: string
  name: string
  attributes: Record<string, unknown>
  current_qty: number
  min_qty: number | null
  max_qty: number | null
  version: number
}

interface SaleEventRow {
  product_id: string | null
  metadata: unknown
  created_at: string
}

const DEFAULT_LEAD_TIME = 3
const DEFAULT_MIN_QTY = 5

export function resolveMinMaxQty(
  asset: { min_qty: number | null; max_qty: number | null },
  settings: { default_min_qty: number | null; default_max_qty: number | null }
): { minQty: number; maxQty: number | null } {
  return {
    minQty: asset.min_qty ?? settings.default_min_qty ?? DEFAULT_MIN_QTY,
    maxQty: asset.max_qty ?? settings.default_max_qty ?? null,
  }
}

export interface PredictionCalcInput {
  currentQty: number
  velocity7d: number
  velocity30d: number
  minQty: number
  maxQty: number | null
  leadTimeDays: number
  mode: PredictionMode
  horizonDays: number
}

export function computePrediction(input: PredictionCalcInput): PredictionResult {
  const rate7 = input.velocity7d / 7
  const rate30 = input.velocity30d / 30

  const dailyRate =
    input.mode === 'minmax'
      ? rate30
      : input.mode === 'trend'
        ? 0.8 * rate7 + 0.2 * rate30
        : 0.5 * rate7 + 0.5 * rate30

  const safetyDays = input.mode === 'minmax' ? 0 : Math.max(1, Math.ceil(input.leadTimeDays * 0.25))

  const reorderPoint =
    input.mode === 'minmax'
      ? input.minQty
      : input.mode === 'trend'
        ? Math.ceil(dailyRate * (input.leadTimeDays + safetyDays))
        : Math.max(input.minQty, Math.ceil(dailyRate * (input.leadTimeDays + safetyDays)))

  const forecastQty = Math.round(dailyRate * input.horizonDays)

  let suggestedQty = Math.max(0, reorderPoint - input.currentQty)
  if (input.maxQty !== null) {
    suggestedQty = Math.min(suggestedQty, Math.max(0, input.maxQty - input.currentQty))
  }

  const confidence =
    input.velocity7d > 0 && input.velocity30d > 0
      ? 0.85
      : input.velocity30d > 0
        ? 0.65
        : input.velocity7d > 0
          ? 0.5
          : 0.2

  return {
    model: input.mode,
    forecast_qty: forecastQty,
    suggested_qty: suggestedQty,
    reorder_point: reorderPoint,
    min_qty: input.minQty,
    max_qty: input.maxQty,
    confidence,
  }
}

export interface PredictionUpsertInput {
  businessId: string
  assetId: string
  currentQty: number
  horizonDays: number
  velocity7d: number
  velocity30d: number
  leadTimeDays: number
  result: PredictionResult
}

export async function upsertPrediction(input: PredictionUpsertInput): Promise<void> {
  const supabase = createInventoryAdmin()
  const { error } = await supabase
    .from('predictions')
    .upsert(
      {
        business_id: input.businessId,
        asset_id: input.assetId,
        horizon_days: input.horizonDays,
        model: input.result.model,
        forecast_qty: input.result.forecast_qty,
        suggested_qty: input.result.suggested_qty,
        reorder_point: input.result.reorder_point,
        min_qty: input.result.min_qty,
        max_qty: input.result.max_qty,
        velocity7d: input.velocity7d,
        velocity30d: input.velocity30d,
        lead_time_days: input.leadTimeDays,
        confidence: input.result.confidence,
        inputs: {
          current_qty: input.currentQty,
          mode: input.result.model,
          horizon_days: input.horizonDays,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'business_id,asset_id,horizon_days,model', ignoreDuplicates: false }
    )
  if (error) throw error
}

export async function generatePredictions(
  businessId: string,
  horizonDays = 30
): Promise<{ created: number; refreshed: number }> {
  const supabase = createInventoryAdmin()
  const pub = createAdminClient()

  const settings = (await getInventorySettings(businessId)) as unknown as SettingsRow | null
  const mode: PredictionMode = settings?.prediction_mode ?? 'hybrid'
  const leadTimeDays = settings?.lead_time_days ?? DEFAULT_LEAD_TIME

  const [{ data: assets, error: assetsError }, { data: sales, error: salesError }] = await Promise.all([
    supabase
      .from('assets')
      .select('id, business_id, item_type, tracking_mode, name, current_qty, min_qty, max_qty, version')
      .eq('business_id', businessId)
      .eq('tracking_mode', 'quantity')
      .eq('is_active', true),
    pub
      .from('sales_events')
      .select('product_id, metadata, created_at')
      .eq('business_id', businessId)
      .eq('event_type', 'SALE_WON')
      .gte('created_at', new Date(Date.now() - 30 * 86_400_000).toISOString()),
  ])

  if (assetsError) throw assetsError
  if (salesError) throw salesError

  const salesByProduct = new Map<string, { created_at: string; quantity: number }[]>()
  for (const event of (sales ?? []) as unknown as SaleEventRow[]) {
    const quantities = saleQuantities(event)
    for (const [productId, qty] of quantities) {
      const list = salesByProduct.get(productId) ?? []
      list.push({ created_at: event.created_at, quantity: qty })
      salesByProduct.set(productId, list)
    }
  }

  const rows = (assets ?? []) as unknown as AssetRow[]
  let created = 0
  let refreshed = 0

  for (const asset of rows) {
    const { minQty, maxQty } = resolveMinMaxQty(asset, {
      default_min_qty: settings?.default_min_qty ?? null,
      default_max_qty: settings?.default_max_qty ?? null,
    })

    const productId = (asset.attributes?.product_id as string | undefined) ?? null
    const assetSales = productId ? (salesByProduct.get(productId) ?? []) : []

    const result = computePrediction({
      currentQty: asset.current_qty,
      velocity7d: unitsSoldInWindow(assetSales, 7),
      velocity30d: unitsSoldInWindow(assetSales, 30),
      minQty,
      maxQty,
      leadTimeDays,
      mode,
      horizonDays,
    })

    if (result.suggested_qty <= 0) continue

    const { data: existing } = await supabase
      .from('predictions')
      .select('id')
      .eq('business_id', businessId)
      .eq('asset_id', asset.id)
      .eq('horizon_days', horizonDays)
      .eq('model', mode)
      .maybeSingle()

    await upsertPrediction({
      businessId,
      assetId: asset.id,
      currentQty: asset.current_qty,
      horizonDays,
      velocity7d: unitsSoldInWindow(assetSales, 7),
      velocity30d: unitsSoldInWindow(assetSales, 30),
      leadTimeDays,
      result,
    })

    if (existing) refreshed++
    else created++
  }

  return { created, refreshed }
}

export interface PredictionWithAsset {
  id: string
  business_id: string
  asset_id: string
  horizon_days: number
  model: PredictionMode
  forecast_qty: number | null
  suggested_qty: number | null
  reorder_point: number | null
  min_qty: number | null
  max_qty: number | null
  velocity7d: number
  velocity30d: number
  lead_time_days: number
  confidence: number | null
  generated_at: string
  updated_at: string
  asset_name: string
}

export async function listPredictions(businessId: string): Promise<PredictionWithAsset[]> {
  const supabase = createInventoryAdmin()

  const { data, error } = await supabase
    .from('predictions')
    .select('*')
    .eq('business_id', businessId)
    .order('generated_at', { ascending: false })
    .limit(200)

  if (error) throw error

  const rows = (data ?? []) as unknown as PredictionWithAsset[]
  const assetIds = [...new Set(rows.map((r) => r.asset_id))]

  if (assetIds.length === 0) return []

  const { data: assets, error: assetsError } = await supabase
    .from('assets')
    .select('id, name')
    .in('id', assetIds)

  if (assetsError) throw assetsError

  const byId = new Map<string, string>()
  for (const a of (assets ?? []) as unknown as Array<{ id: string; name: string }>) {
    byId.set(a.id, a.name)
  }

  return rows.map((row) => ({
    ...row,
    asset_name: byId.get(row.asset_id) ?? 'Asset',
  }))
}
