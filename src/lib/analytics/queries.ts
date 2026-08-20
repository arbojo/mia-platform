import { createAnalyticsAdmin } from './db'

export interface SalesDailyRow {
  business_id: string
  date: string
  won_count: number
  lost_count: number
  cancelled_count: number
  started_count: number
  selected_count: number
  price_accepted_count: number
  price_rejected_count: number
  revenue: number
  conversion_rate: number
  avg_order_value: number
}

export interface ProductPerformanceRow {
  business_id: string
  product_id: string
  product_name: string
  times_presented: number
  times_selected: number
  times_sold: number
  revenue: number
  conversion_rate: number
  avg_deal_value: number
}

export interface AiCostDailyRow {
  business_id: string
  date: string
  total_requests: number
  total_tokens: number
  total_cost: number
  avg_cost_per_request: number
  avg_duration_ms: number
  cost_by_type: Record<string, { count: number; cost: number }>
}

export interface CustomerInsightRow {
  business_id: string
  customer_id: string
  customer_name: string
  customer_city: string | null
  customer_status: string | null
  conversations_started: number
  sales_won: number
  sales_lost: number
  sales_cancelled: number
  total_value: number
  last_purchase_at: string | null
}

export interface SummarySnapshot {
  totalRevenue: number
  totalOrders: number
  avgConversion: number
  avgOrderValue: number
  totalAiCost: number
  aiCostToday: number
  costPerSale: number
  activeCustomers: number
}

export interface AnalyticsSummary extends SummarySnapshot {
  ltv: number
  cac: number
  ltvCacRatio: number
  ltvCacHealth: 'healthy' | 'warning' | 'critical'
  revenueDelta: number | null
  ordersDelta: number | null
  conversionDelta: number | null
  avgOrderValueDelta: number | null
}

export interface AnalyticsOverview {
  salesDaily: SalesDailyRow[]
  topProducts: ProductPerformanceRow[]
  aiCostDaily: AiCostDailyRow[]
  topCustomers: CustomerInsightRow[]
  summary: AnalyticsSummary
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

function computeSummary(
  sd: SalesDailyRow[],
  ac: AiCostDailyRow[],
  ci: CustomerInsightRow[],
  today: string
): SummarySnapshot {
  const totalRevenue = sd.reduce((s, r) => s + (r.revenue ?? 0), 0)
  const totalOrders = sd.reduce((s, r) => s + (r.won_count ?? 0), 0)
  const avgConversion =
    sd.length > 0
      ? Math.round(sd.reduce((s, r) => s + (r.conversion_rate ?? 0), 0) / sd.length * 10) / 10
      : 0
  const avgOrderValue =
    totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0
  const totalAiCost = ac.reduce((s, r) => s + (r.total_cost ?? 0), 0)
  const aiCostToday = ac.find((r) => r.date === today)?.total_cost ?? 0
  const costPerSale = totalOrders > 0 ? Math.round((totalAiCost / totalOrders) * 10000) / 10000 : 0
  const activeCustomers = ci.length

  return {
    totalRevenue,
    totalOrders,
    avgConversion,
    avgOrderValue,
    totalAiCost: Math.round(totalAiCost * 10000) / 10000,
    aiCostToday: Math.round(aiCostToday * 10000) / 10000,
    costPerSale,
    activeCustomers,
  }
}

function deltaPercent(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return null
  if (previous === 0) return current > 0 ? 100 : -100
  return Math.round(((current - previous) / previous) * 1000) / 10
}

export async function getAnalyticsOverview(
  businessId: string,
  days = 30
): Promise<AnalyticsOverview> {
  const supabase = createAnalyticsAdmin()
  const since = daysAgo(days)
  const prevSince = daysAgo(days * 2)
  const today = daysAgo(0)

  const [
    { data: salesDaily },
    { data: topProducts },
    { data: aiCostDaily },
    { data: topCustomers },
    { data: prevSalesDaily },
    { data: prevAiCostDaily },
  ] = await Promise.all([
    supabase
      .from('sales_daily' as never)
      .select('*')
      .eq('business_id', businessId)
      .gte('date', since)
      .order('date', { ascending: true }) as never,
    supabase
      .from('product_performance' as never)
      .select('*')
      .eq('business_id', businessId)
      .order('revenue', { ascending: false })
      .limit(10) as never,
    supabase
      .from('ai_cost_daily' as never)
      .select('*')
      .eq('business_id', businessId)
      .gte('date', since)
      .order('date', { ascending: true }) as never,
    supabase
      .from('customer_insights' as never)
      .select('*')
      .eq('business_id', businessId)
      .order('total_value', { ascending: false })
      .limit(10) as never,
    supabase
      .from('sales_daily' as never)
      .select('*')
      .eq('business_id', businessId)
      .gte('date', prevSince)
      .lt('date', since)
      .order('date', { ascending: true }) as never,
    supabase
      .from('ai_cost_daily' as never)
      .select('*')
      .eq('business_id', businessId)
      .gte('date', prevSince)
      .lt('date', since)
      .order('date', { ascending: true }) as never,
  ])

  const sd = (salesDaily ?? []) as unknown as SalesDailyRow[]
  const pp = (topProducts ?? []) as unknown as ProductPerformanceRow[]
  const ac = (aiCostDaily ?? []) as unknown as AiCostDailyRow[]
  const ci = (topCustomers ?? []) as unknown as CustomerInsightRow[]
  const prevSd = (prevSalesDaily ?? []) as unknown as SalesDailyRow[]
  const prevAc = (prevAiCostDaily ?? []) as unknown as AiCostDailyRow[]

  const current = computeSummary(sd, ac, ci, today)
  const previous = computeSummary(prevSd, prevAc, [], today)

  const ltv = current.activeCustomers > 0
    ? Math.round((current.avgOrderValue * (current.totalOrders / current.activeCustomers)) * 100) / 100
    : 0
  const cac = current.activeCustomers > 0
    ? Math.round((current.totalAiCost / current.activeCustomers) * 10000) / 10000
    : 0
  const ltvCacRatio = cac > 0 ? Math.round((ltv / cac) * 10) / 10 : 0
  const ltvCacHealth: 'healthy' | 'warning' | 'critical' =
    ltvCacRatio >= 3 ? 'healthy' : ltvCacRatio >= 2 ? 'warning' : 'critical'

  return {
    salesDaily: sd,
    topProducts: pp,
    aiCostDaily: ac,
    topCustomers: ci,
    summary: {
      ...current,
      ltv,
      cac,
      ltvCacRatio,
      ltvCacHealth,
      revenueDelta: deltaPercent(current.totalRevenue, previous.totalRevenue),
      ordersDelta: deltaPercent(current.totalOrders, previous.totalOrders),
      conversionDelta: deltaPercent(current.avgConversion, previous.avgConversion),
      avgOrderValueDelta: deltaPercent(current.avgOrderValue, previous.avgOrderValue),
    },
  }
}

export async function refreshAnalyticsViews(): Promise<void> {
  const supabase = createAnalyticsAdmin()
  await supabase.rpc('refresh_analytics_views' as never)
}

// ============================================================
// Inventory Analytics
// ============================================================

export interface InventoryDailyRow {
  business_id: string
  date: string
  stock_in: number
  stock_out: number
  net_change: number
  adjustments: number
  waste: number
  items_sold: number
  total_cost_in: number
  total_cost_out: number
}

export interface ProductMarginRow {
  business_id: string
  product_id: string
  product_name: string
  revenue: number
  cogs: number
  gross_margin: number
  gross_margin_pct: number
  units_sold: number
  avg_unit_cost: number
  avg_selling_price: number
}

export interface StockHealthRow {
  business_id: string
  total_items: number
  items_green: number
  items_yellow: number
  items_red: number
  total_stock_value: number
  low_stock_count: number
  out_of_stock_count: number
  health_score: number
}

export interface InventoryOverview {
  daily: InventoryDailyRow[]
  productMargins: ProductMarginRow[]
  stockHealth: StockHealthRow
  summary: {
    totalStockValue: number
    outOfStockCount: number
    healthScore: number
    avgGrossMargin: number
    totalCOGS: number
    wasteCount: number
  }
}

export async function getInventoryOverview(
  businessId: string,
  days = 30
): Promise<InventoryOverview> {
  const supabase = createAnalyticsAdmin()
  const since = daysAgo(days)

  const [{ data: daily }, { data: productMargins }, { data: stockHealthArr }] = await Promise.all([
    supabase
      .from('inventory_daily' as never)
      .select('*')
      .eq('business_id', businessId)
      .gte('date', since)
      .order('date', { ascending: true }) as never,
    supabase
      .from('product_margin' as never)
      .select('*')
      .eq('business_id', businessId)
      .order('gross_margin', { ascending: false })
      .limit(10) as never,
    supabase
      .from('stock_health' as never)
      .select('*')
      .eq('business_id', businessId)
      .limit(1) as never,
  ])

  const d = (daily ?? []) as unknown as InventoryDailyRow[]
  const pm = (productMargins ?? []) as unknown as ProductMarginRow[]
  const sh = ((stockHealthArr ?? [])[0] as unknown as StockHealthRow) ?? {
    business_id: businessId,
    total_items: 0,
    items_green: 0,
    items_yellow: 0,
    items_red: 0,
    total_stock_value: 0,
    low_stock_count: 0,
    out_of_stock_count: 0,
    health_score: 0,
  }

  const totalStockValue = sh.total_stock_value
  const outOfStockCount = sh.out_of_stock_count
  const healthScore = sh.health_score
  const totalCOGS = pm.reduce((s, r) => s + (r.cogs ?? 0), 0)
  const wasteCount = d.reduce((s, r) => s + (r.waste ?? 0), 0)
  const avgGrossMargin = pm.length > 0
    ? Math.round(pm.reduce((s, r) => s + (r.gross_margin_pct ?? 0), 0) / pm.length * 10) / 10
    : 0

  return {
    daily: d,
    productMargins: pm,
    stockHealth: sh,
    summary: {
      totalStockValue: Math.round(totalStockValue * 100) / 100,
      outOfStockCount,
      healthScore,
      avgGrossMargin,
      totalCOGS: Math.round(totalCOGS * 100) / 100,
      wasteCount,
    },
  }
}
