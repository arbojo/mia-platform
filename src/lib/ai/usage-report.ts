import { createAdminClient } from '@/lib/supabase/admin'

export interface MonthlyUsage {
  totalTokens: number
  totalCost: number
  totalRequests: number
  avgTokensPerRequest: number
  costBySource: Array<{ source: string; cost: number; tokens: number; requests: number }>
  costByType: Array<{ requestType: string; cost: number; tokens: number; requests: number }>
  dailyBreakdown: Array<{ date: string; cost: number; tokens: number; requests: number }>
}

export interface CostProjection {
  currentMonthCost: number
  projectedMonthlyCost: number
  daysElapsed: number
  daysInMonth: number
  dailyAverage: number
}

export interface UsageStats {
  totalTokensAllTime: number
  totalCostAllTime: number
  totalRequestsAllTime: number
  topSources: Array<{ source: string; cost: number; percentage: number }>
  lastUpdated: string
}

export async function getMonthlyUsage(businessId: string): Promise<MonthlyUsage> {
  const supabase = createAdminClient()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { data: usage } = await supabase
    .from('ai_usage')
    .select('tokens_input, tokens_output, cost, request_type, source, created_at')
    .eq('business_id', businessId)
    .gte('created_at', monthStart)

  const rows = usage ?? []
  const totalTokens = rows.reduce((s, r) => s + (r.tokens_input ?? 0) + (r.tokens_output ?? 0), 0)
  const totalCost = rows.reduce((s, r) => s + (r.cost ?? 0), 0)
  const totalRequests = rows.length

  const requestsBySource = new Map<string, { cost: number; tokens: number; requests: number }>()
  const requestsByType = new Map<string, { cost: number; tokens: number; requests: number }>()
  const requestsByDay = new Map<string, { cost: number; tokens: number; requests: number }>()

  for (const r of rows) {
    const source = r.source ?? 'unknown'
    const type = r.request_type ?? 'unknown'
    const day = (r.created_at ?? '').split('T')[0]
    const tokens = (r.tokens_input ?? 0) + (r.tokens_output ?? 0)

    if (!requestsBySource.has(source)) requestsBySource.set(source, { cost: 0, tokens: 0, requests: 0 })
    const s = requestsBySource.get(source)!
    s.cost += r.cost ?? 0
    s.tokens += tokens
    s.requests++

    if (!requestsByType.has(type)) requestsByType.set(type, { cost: 0, tokens: 0, requests: 0 })
    const t = requestsByType.get(type)!
    t.cost += r.cost ?? 0
    t.tokens += tokens
    t.requests++

    if (!requestsByDay.has(day)) requestsByDay.set(day, { cost: 0, tokens: 0, requests: 0 })
    const d = requestsByDay.get(day)!
    d.cost += r.cost ?? 0
    d.tokens += tokens
    d.requests++
  }

  return {
    totalTokens,
    totalCost: Math.round(totalCost * 1000000) / 1000000,
    totalRequests,
    avgTokensPerRequest: totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0,
    costBySource: Array.from(requestsBySource.entries())
      .map(([k, v]) => ({ source: k, cost: Math.round(v.cost * 1000000) / 1000000, tokens: v.tokens, requests: v.requests }))
      .sort((a, b) => b.cost - a.cost),
    costByType: Array.from(requestsByType.entries())
      .map(([k, v]) => ({ requestType: k, cost: Math.round(v.cost * 1000000) / 1000000, tokens: v.tokens, requests: v.requests }))
      .sort((a, b) => b.cost - a.cost),
    dailyBreakdown: Array.from(requestsByDay.entries())
      .map(([k, v]) => ({ date: k, cost: Math.round(v.cost * 1000000) / 1000000, tokens: v.tokens, requests: v.requests }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  }
}

export async function getCostProjection(businessId: string): Promise<CostProjection> {
  const monthly = await getMonthlyUsage(businessId)
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysElapsed = now.getDate()

  const dailyAverage = daysElapsed > 0 ? monthly.totalCost / daysElapsed : 0

  return {
    currentMonthCost: monthly.totalCost,
    projectedMonthlyCost: Math.round(dailyAverage * daysInMonth * 1000000) / 1000000,
    daysElapsed,
    daysInMonth,
    dailyAverage: Math.round(dailyAverage * 1000000) / 1000000,
  }
}

export async function getAllTimeStats(businessId: string): Promise<UsageStats> {
  const supabase = createAdminClient()

  const { data: usage } = await supabase
    .from('ai_usage')
    .select('tokens_input, tokens_output, cost, source')
    .eq('business_id', businessId)

  const rows = usage ?? []
  const totalTokens = rows.reduce((s, r) => s + (r.tokens_input ?? 0) + (r.tokens_output ?? 0), 0)
  const totalCost = rows.reduce((s, r) => s + (r.cost ?? 0), 0)
  const totalRequests = rows.length

  const costBySource = new Map<string, number>()
  for (const r of rows) {
    const source = r.source ?? 'unknown'
    costBySource.set(source, (costBySource.get(source) ?? 0) + (r.cost ?? 0))
  }

  return {
    totalTokensAllTime: totalTokens,
    totalCostAllTime: Math.round(totalCost * 1000000) / 1000000,
    totalRequestsAllTime: totalRequests,
    topSources: Array.from(costBySource.entries())
      .map(([k, v]) => ({ source: k, cost: Math.round(v * 1000000) / 1000000, percentage: totalCost > 0 ? Math.round((v / totalCost) * 100) : 0 }))
      .sort((a, b) => b.cost - a.cost),
    lastUpdated: new Date().toISOString(),
  }
}

export async function getUsageByBusinessId(
  businessId: string
): Promise<{ monthly: MonthlyUsage; projection: CostProjection; allTime: UsageStats }> {
  const [monthly, projection, allTime] = await Promise.all([
    getMonthlyUsage(businessId),
    getCostProjection(businessId),
    getAllTimeStats(businessId),
  ])

  return { monthly, projection, allTime }
}
