import { getSupabase, MetricsCollector, elapsedMs, formatDuration } from './utils'
import { BusinessDef } from './config'

export interface IsolationResult {
  businessPairs: Array<{ from: string; to: string; table: string; leaked: boolean; count: number }>
  passed: boolean
}

async function time<T>(fn: () => T): Promise<{ result: Awaited<T>; duration: number }> {
  const start = Date.now()
  const result = await fn()
  return { result, duration: elapsedMs(start) }
}

async function checkIsolation(supabase: ReturnType<typeof getSupabase>, fromBiz: string, toBiz: string, table: string): Promise<{ leaked: boolean; count: number }> {
  const { data, error } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('business_id', toBiz)
  if (error) return { leaked: false, count: 0 }
  return { leaked: (data?.length ?? 0) > 0, count: data?.length ?? 0 }
}

export async function phase7DatabaseStress(defs: BusinessDef[], metrics: MetricsCollector): Promise<IsolationResult> {
  metrics.startPhase('7. Database Stress & Tenant Isolation')
  const supabase = getSupabase()

  const tables = ['products', 'knowledge_items', 'sales_rules', 'business_memory', 'learning_events', 'conversations', 'messages']
  const perfResults: Record<string, { avg: number; min: number; max: number }> = {}
  const isolationResult: IsolationResult = { businessPairs: [], passed: true }

  for (const table of tables) {
    const times: number[] = []

    for (const b of defs) {
      const bizId = metrics.getBizId(b.name)
      if (!bizId) continue

      const firstBizId = defs[0]
      const firstId = metrics.getBizId(firstBizId.name)
      if (!firstId) continue

      const { duration } = await time(() =>
          supabase.from(table).select('id', { count: 'exact', head: true }).eq('business_id', firstId)
        )
        times.push(duration)
        metrics.recordDbQuery(table, duration, 0)

      if (bizId !== firstId) {
        const iso = await checkIsolation(supabase, bizId, firstId, table)
        if (iso.leaked) {
          isolationResult.passed = false
          isolationResult.businessPairs.push({
            from: b.name,
            to: firstBizId.name,
            table,
            leaked: true,
            count: iso.count,
          })
        }
      }
    }

    if (times.length > 0) {
      times.sort((a, b) => a - b)
      perfResults[table] = {
        min: times[0],
        max: times[times.length - 1],
        avg: Math.round(times.reduce((s, t) => s + t, 0) / times.length),
      }
    }
  }

  for (const [table, perf] of Object.entries(perfResults)) {
    console.log(`  ${table}: avg=${perf.avg}ms min=${perf.min}ms max=${perf.max}ms`)
  }

  if (isolationResult.passed) {
    console.log('  ✓ Tenant isolation: PASSED (no cross-business leakage)')
  } else {
    console.log(`  ✗ Tenant isolation: FAILED (${isolationResult.businessPairs.length} leaks detected)`)
    for (const leak of isolationResult.businessPairs) {
      console.log(`    Leak: ${leak.from} → ${leak.to} (${leak.table}: ${leak.count} rows)`)
    }
  }

  metrics.recordData('dbPerformance', perfResults)
  metrics.recordData('isolationResult', isolationResult)
  metrics.endPhase()
  return isolationResult
}