import { getSupabase, MetricsCollector, formatDuration } from './utils'
import { BusinessDef } from './config'

export interface CostReport {
  perBusiness: Array<{ name: string; requests: number; inputTokens: number; outputTokens: number; cost: number }>
  totalCalls: number
  totalInput: number
  totalOutput: number
  totalCost: number
}

export async function phase6CostMeasurement(defs: BusinessDef[], metrics: MetricsCollector): Promise<CostReport> {
  metrics.startPhase('6. AI Cost Measurement')
  const supabase = getSupabase()

  const perBusiness: CostReport['perBusiness'] = []

  for (const b of defs) {
    const bizId = metrics.getBizId(b.name)
    if (!bizId) {
      metrics.recordFailure(`Phase6: No business ID for ${b.name}`)
      continue
    }

    const { data: usage } = await supabase
      .from('ai_usage')
      .select('tokens_input, tokens_output, cost, source')
      .eq('business_id', bizId)

    const rows = usage ?? []
    const inputTokens = rows.reduce((s, r) => s + (r.tokens_input ?? 0), 0)
    const outputTokens = rows.reduce((s, r) => s + (r.tokens_output ?? 0), 0)
    const cost = rows.reduce((s, r) => s + (r.cost ?? 0), 0)

    perBusiness.push({
      name: b.name,
      requests: rows.length,
      inputTokens,
      outputTokens,
      cost: Math.round(cost * 1_000_000) / 1_000_000,
    })

    const sources = new Map<string, number>()
    for (const r of rows) {
      const src = r.source ?? 'unknown'
      sources.set(src, (sources.get(src) ?? 0) + (r.cost ?? 0))
    }

    metrics.recordData(`cost_sources_${b.name}`, Object.fromEntries(sources))
  }

  const totalCalls = perBusiness.reduce((s, b) => s + b.requests, 0)
  const totalInput = perBusiness.reduce((s, b) => s + b.inputTokens, 0)
  const totalOutput = perBusiness.reduce((s, b) => s + b.outputTokens, 0)
  const totalCost = perBusiness.reduce((s, b) => s + b.cost, 0)

  const report: CostReport = {
    perBusiness,
    totalCalls,
    totalInput,
    totalOutput,
    totalCost: Math.round(totalCost * 1_000_000) / 1_000_000,
  }

  for (const b of perBusiness) {
    console.log(`  ${b.name}: ${b.requests} calls, ${(b.inputTokens + b.outputTokens).toLocaleString()} tokens, $${b.cost}`)
  }
  console.log(`  TOTAL: ${totalCalls} calls, ${(totalInput + totalOutput).toLocaleString()} tokens, $${totalCost.toFixed(4)}`)

  metrics.recordData('costReport', report)
  metrics.endPhase()
  return report
}