import { createInventoryAdmin } from './db'
import { createAdminClient } from '@/lib/supabase/admin'
import { daysSince, stockStatus, unitsSoldInWindow } from './rules'
import type { StockItemWithProduct, StockStatus } from './types'
import { canBusinessUseInventoryHub } from '@/lib/system/edition'

interface ProductRow {
  id: string
  name: string
  sku: string | null
  price: number | null
}

interface SaleEvent {
  product_id: string | null
  metadata: unknown
  created_at: string
}

export function saleQuantities(event: SaleEvent): Map<string, number> {
  const result = new Map<string, number>()
  const metadata = (event.metadata ?? {}) as { items?: unknown[] }
  const items = Array.isArray(metadata.items) ? metadata.items : []

  if (items.length === 0 && event.product_id) {
    result.set(event.product_id, 1)
    return result
  }

  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue
    const item = raw as { product_id?: string; quantity?: number }
    if (!item.product_id) continue
    const qty = typeof item.quantity === 'number' ? Math.max(0, item.quantity) : 1
    result.set(item.product_id, (result.get(item.product_id) ?? 0) + qty)
  }

  return result
}

export interface InventoryListingInput {
  businessId: string
  products: ProductRow[]
  stockByProduct: Record<string, { quantity: number; low_stock_threshold: number; version: number }>
  sales30d: SaleEvent[]
}

export function buildStockListing(input: InventoryListingInput): StockItemWithProduct[] {
  const salesByProduct = new Map<string, { created_at: string; quantity: number }[]>()
  for (const event of input.sales30d) {
    const quantities = saleQuantities(event)
    for (const [productId, qty] of quantities) {
      const list = salesByProduct.get(productId) ?? []
      list.push({ created_at: event.created_at, quantity: qty })
      salesByProduct.set(productId, list)
    }
  }

  return input.products.map((product) => {
    const stock = input.stockByProduct[product.id]
    const quantity = stock?.quantity ?? 0
    const threshold = stock?.low_stock_threshold ?? 0
    const status: StockStatus = stock ? stockStatus(quantity, threshold) : 'out'
    const sales = salesByProduct.get(product.id) ?? []
    const lastSale = sales.length > 0 ? sales.reduce((a, b) => (a.created_at > b.created_at ? a : b)).created_at : null

    return {
      business_id: input.businessId,
      product_id: product.id,
      quantity,
      low_stock_threshold: threshold,
      version: stock?.version ?? 1,
      created_at: '',
      updated_at: '',
      product_name: product.name,
      sku: product.sku,
      price: product.price,
      status,
      daysOut: daysSince(lastSale),
      velocity7d: unitsSoldInWindow(sales, 7),
      velocity30d: unitsSoldInWindow(sales, 30),
    }
  })
}

export async function getStockOverview(businessId: string) {
  const inv = createInventoryAdmin()
  const pub = createAdminClient()

  const [assetsResult, bridgeResult, productsResult, salesResult] = await Promise.all([
    inv
      .from('assets')
      .select('id, business_id, item_type, tracking_mode, code, name, attributes, current_qty, min_qty, max_qty, version, is_active')
      .eq('business_id', businessId)
      .eq('tracking_mode', 'quantity')
      .eq('is_active', true),
    inv
      .from('asset_products')
      .select('asset_id, product_id')
      .eq('business_id', businessId),
    pub
      .from('products')
      .select('id, name, sku, price')
      .eq('business_id', businessId)
      .eq('is_active', true),
    pub
      .from('sales_events')
      .select('product_id, metadata, created_at')
      .eq('business_id', businessId)
      .eq('event_type', 'SALE_WON')
      .gte('created_at', new Date(Date.now() - 30 * 86_400_000).toISOString()),
  ])

  if (assetsResult.error) throw assetsResult.error
  if (bridgeResult.error) throw bridgeResult.error
  if (productsResult.error) throw productsResult.error
  if (salesResult.error) throw salesResult.error

  const assetById = new Map<string, { current_qty: number; min_qty: number | null; version: number }>()
  for (const asset of assetsResult.data ?? []) {
    assetById.set(asset.id as string, {
      current_qty: asset.current_qty as number,
      min_qty: asset.min_qty as number | null,
      version: asset.version as number,
    })
  }

  const stockByProduct: Record<string, { quantity: number; low_stock_threshold: number; version: number }> = {}
  for (const bridge of bridgeResult.data ?? []) {
    const asset = assetById.get(bridge.asset_id as string)
    if (!asset) continue
    stockByProduct[bridge.product_id as string] = {
      quantity: asset.current_qty,
      low_stock_threshold: asset.min_qty ?? 0,
      version: asset.version,
    }
  }

  const items = buildStockListing({
    businessId,
    products: productsResult.data as unknown as ProductRow[],
    stockByProduct,
    sales30d: salesResult.data as unknown as SaleEvent[],
  })

  const totals = items.reduce(
    (acc, item) => {
      acc.total++
      if (item.status === 'out') acc.out++
      else if (item.status === 'low') acc.low++
      else acc.ok++
      return acc
    },
    { total: 0, ok: 0, low: 0, out: 0 }
  )

  return { items, totals }
}

export interface CatalogAvailability {
  quantity: number
  status: StockStatus
  low_stock_threshold: number
}

export async function getCatalogAvailability(
  businessId: string,
  productIds: string[]
): Promise<Record<string, CatalogAvailability> | null> {
  if (!(await canBusinessUseInventoryHub(businessId))) return null

  const inv = createInventoryAdmin()

  const { data: settings, error: settingsError } = await inv
    .from('business_settings')
    .select('enabled')
    .eq('business_id', businessId)
    .maybeSingle()

  if (settingsError) throw settingsError
  if (!settings?.enabled) return null

  if (productIds.length === 0) return {}

  const { data: bridge, error: bridgeError } = await inv
    .from('asset_products')
    .select('asset_id, product_id')
    .eq('business_id', businessId)
    .in('product_id', productIds)

  if (bridgeError) throw bridgeError

  const assetIds = [...new Set((bridge ?? []).map((b) => b.asset_id as string))]
  if (assetIds.length === 0) return {}

  const { data, error } = await inv
    .from('assets')
    .select('id, current_qty, min_qty')
    .eq('business_id', businessId)
    .in('id', assetIds)

  if (error) throw error

  const assetById = new Map<string, { current_qty: number; min_qty: number | null }>()
  for (const asset of data ?? []) {
    assetById.set(asset.id as string, {
      current_qty: asset.current_qty as number,
      min_qty: asset.min_qty as number | null,
    })
  }

  const result: Record<string, CatalogAvailability> = {}
  for (const row of bridge ?? []) {
    const asset = assetById.get(row.asset_id as string)
    if (!asset) continue
    const threshold = asset.min_qty ?? 0
    result[row.product_id as string] = {
      quantity: asset.current_qty,
      low_stock_threshold: threshold,
      status: stockStatus(asset.current_qty, threshold),
    }
  }

  return result
}
