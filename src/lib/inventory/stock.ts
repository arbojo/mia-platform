import { createInventoryAdmin } from './db'
import { createAdminClient } from '@/lib/supabase/admin'
import { daysSince, stockStatus, unitsSoldInWindow } from './rules'
import type { StockItemWithProduct, StockStatus } from './types'
import { canUseInventoryHub } from '@/lib/system/edition'

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
  stockByProduct: Record<string, { quantity: number; low_stock_threshold: number }>
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
      version: 1,
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

  const [stockResult, productsResult, salesResult] = await Promise.all([
    inv.from('stock_items').select('*').eq('business_id', businessId),
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

  if (stockResult.error) throw stockResult.error
  if (productsResult.error) throw productsResult.error
  if (salesResult.error) throw salesResult.error

  const stockByProduct: Record<string, { quantity: number; low_stock_threshold: number }> = {}
  for (const item of stockResult.data ?? []) {
    stockByProduct[item.product_id] = {
      quantity: item.quantity,
      low_stock_threshold: item.low_stock_threshold,
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
  if (!canUseInventoryHub()) return null

  const inv = createInventoryAdmin()

  const { data: settings, error: settingsError } = await inv
    .from('business_settings')
    .select('enabled')
    .eq('business_id', businessId)
    .maybeSingle()

  if (settingsError) throw settingsError
  if (!settings?.enabled) return null

  if (productIds.length === 0) return {}

  const { data, error } = await inv
    .from('stock_items')
    .select('product_id, quantity, low_stock_threshold')
    .eq('business_id', businessId)
    .in('product_id', productIds)

  if (error) throw error

  const result: Record<string, CatalogAvailability> = {}
  for (const item of (data ?? []) as Array<{
    product_id: string
    quantity: number
    low_stock_threshold: number
  }>) {
    result[item.product_id] = {
      quantity: item.quantity,
      low_stock_threshold: item.low_stock_threshold,
      status: stockStatus(item.quantity, item.low_stock_threshold),
    }
  }

  return result
}
