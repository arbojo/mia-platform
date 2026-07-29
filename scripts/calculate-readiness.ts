import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { calculateReadiness } from '../src/lib/ai/readiness'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const BUSINESS_ID = '0d40a769-7a21-4cb3-9472-bdc9638675d6'

async function main() {
  console.log('=== MIA READINESS CALCULATION FOR VITANOVA ===\n')

  const result = await calculateReadiness(supabase, BUSINESS_ID)

  console.log('SCORES:')
  console.log(`  Overall:     ${result.overall}/100`)
  console.log(`  Preparation: ${result.preparation}/100`)
  console.log(`  Confidence:  ${result.confidence}/100`)
  console.log(`  Performance: ${result.performance ?? 'N/A (no live conversations)'}`)
  console.log('')

  console.log('MATURITY STAGE:')
  console.log(`  Stage: ${result.maturity.stage}`)
  console.log(`  Next stage: ${result.maturity.thresholds.nextStage ?? 'none (max stage)'}`)
  if (result.maturity.thresholds.requirements.length > 0) {
    console.log('  Requirements for next stage:')
    result.maturity.thresholds.requirements.forEach(r => console.log(`    - ${r}`))
  }
  console.log('')

  console.log('PREPARATION DETAIL:')
  console.log(`  Score: ${result.preparationDetail.score}`)
  console.log(`  Message: ${result.preparationDetail.message}`)
  result.preparationDetail.subcategories.forEach(s => {
    console.log(`  [${s.label.padEnd(25)}] ${s.score}/100 (weight: ${s.weight}) — ${s.description}`)
  })
  if (result.preparationDetail.guidance) {
    console.log(`  Guidance: ${result.preparationDetail.guidance.message}`)
    console.log(`    Action: ${result.preparationDetail.guidance.actionLabel} -> ${result.preparationDetail.guidance.actionHref}`)
  }
  console.log('')

  console.log('CONFIDENCE DETAIL:')
  console.log(`  Score: ${result.confidenceDetail.score}`)
  console.log(`  Message: ${result.confidenceDetail.message}`)
  result.confidenceDetail.subcategories.forEach(s => {
    console.log(`  [${s.label.padEnd(30)}] ${s.score}/100 (weight: ${s.weight}) — ${s.description}`)
  })
  if (result.confidenceDetail.guidance) {
    console.log(`  Guidance: ${result.confidenceDetail.guidance.message}`)
  }
  console.log('')

  if (result.performanceDetail) {
    console.log('PERFORMANCE DETAIL:')
    console.log(`  Score: ${result.performanceDetail.score}`)
    result.performanceDetail.subcategories.forEach(s => {
      console.log(`  [${s.label.padEnd(25)}] ${s.score}/100 (weight: ${s.weight}) — ${s.description}`)
    })
  } else {
    console.log('PERFORMANCE: N/A (no live conversations yet)')
  }
  console.log('')

  console.log('TREND:')
  console.log(`  Snapshots: ${result.trend.length}`)
  if (result.trend.length > 0) {
    result.trend.forEach(t => console.log(`  ${t.date}: P=${t.preparation} C=${t.confidence} O=${t.performance ?? 'N/A'}`))
  }
  console.log('')

  console.log('DELTAS (vs last snapshot):')
  console.log(`  Preparation: ${result.deltas.preparation >= 0 ? '+' : ''}${result.deltas.preparation}`)
  console.log(`  Confidence:  ${result.deltas.confidence >= 0 ? '+' : ''}${result.deltas.confidence}`)
  console.log(`  Performance: ${result.deltas.performance !== null ? (result.deltas.performance >= 0 ? '+' : '') + result.deltas.performance : 'N/A'}`)
  console.log(`  Overall:     ${result.deltas.overall >= 0 ? '+' : ''}${result.deltas.overall}`)
}

main().catch(console.error)
