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

export interface AnalyticsOverview {
  salesDaily: SalesDailyRow[]
  topProducts: ProductPerformanceRow[]
  aiCostDaily: AiCostDailyRow[]
  topCustomers: CustomerInsightRow[]
  summary: {
    totalRevenue: number
    totalOrders: number
    avgConversion: number
    avgOrderValue: number
    totalAiCost: number
    aiCostToday: number
    costPerSale: number
    activeCustomers: number
  }
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

export async function getAnalyticsOverview(
  businessId: string,
  days = 30
): Promise<AnalyticsOverview> {
  const supabase = createAnalyticsAdmin()
  const since = daysAgo(days)
  const today = daysAgo(0)

  const [{ data: salesDaily }, { data: topProducts }, { data: aiCostDaily }, { data: topCustomers }] =
    await Promise.all([
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
    ])

  const sd = (salesDaily ?? []) as unknown as SalesDailyRow[]
  const pp = (topProducts ?? []) as unknown as ProductPerformanceRow[]
  const ac = (aiCostDaily ?? []) as unknown as AiCostDailyRow[]
  const ci = (topCustomers ?? []) as unknown as CustomerInsightRow[]

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
    salesDaily: sd,
    topProducts: pp,
    aiCostDaily: ac,
    topCustomers: ci,
    summary: {
      totalRevenue,
      totalOrders,
      avgConversion,
      avgOrderValue,
      totalAiCost: Math.round(totalAiCost * 10000) / 10000,
      aiCostToday: Math.round(aiCostToday * 10000) / 10000,
      costPerSale,
      activeCustomers,
    },
  }
}

export async function refreshAnalyticsViews(): Promise<void> {
  const supabase = createAnalyticsAdmin()
  await supabase.rpc('refresh_analytics_views' as never)
}
