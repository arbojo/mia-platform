import { config } from 'dotenv'
config({ path: '.env.local' })

import { MODES, generateBusinessDefs } from './config'
import { MetricsCollector, saveTrackingFile, printProgress } from './utils'
import { phase1CreateBusinesses } from './phase1'
import { phase2KnowledgeLoading } from './phase2'
import { phase3Conversations } from './phase3'
import { phase4LearningEvolution } from './phase4'
import { phase5MentorMode } from './phase5'
import { phase6CostMeasurement } from './phase6'
import { phase7DatabaseStress } from './phase7'
import { phase8TimeLapse } from './phase8'
import { generateReport } from './report'

const TOTAL_PHASES = 8

async function main() {
  console.log('╔══════════════════════════════════════════╗')
  console.log('║  MIA PLATFORM — SCALE VALIDATION TEST     ║')
  console.log('╚══════════════════════════════════════════╝')
  console.log()

  const isFullMode = process.argv.includes('--full')
  if (isFullMode) {
    console.log('⚠️  FULL MODE — This will generate significant OpenAI API costs.')
    console.log('   Estimated: ~$6.57 and ~12-14 hours runtime.')
    console.log('   Type "FULL" to confirm:')
    const answer = await new Promise<string>((resolve) => {
      process.stdin.once('data', (data) => resolve(data.toString().trim()))
    })
    if (answer !== 'FULL') {
      console.log('Cancelled.')
      process.exit(0)
    }
    console.log()
  }

  const mode = isFullMode ? 'full' : 'safe'
  const modeConfig = MODES[mode]
  console.log(`Mode: ${mode.toUpperCase()}`)
  console.log(`Businesses: ${modeConfig.maxBusinesses}`)
  console.log(`Conversations per business: ${modeConfig.conversationsPerBusiness}`)
  console.log(`Knowledge documents: ${modeConfig.knowledgeDocuments}`)
  console.log(`Simulated days: ${modeConfig.simulatedDays}`)
  console.log()

  const metrics = new MetricsCollector()
  let exitCode = 0

  try {
    printProgress(0, TOTAL_PHASES, 0, modeConfig.maxBusinesses, 0, modeConfig.conversationsPerBusiness, { tokens: 0, cost: 0, failures: 0 })

    const businessDefs = generateBusinessDefs(modeConfig.maxBusinesses)
    console.log(`Generated ${businessDefs.length} business definitions`)
    console.log()

    // Phase 1
    console.log(`[Phase 1/${TOTAL_PHASES}] Synthetic Business Creation`)
    await phase1CreateBusinesses(businessDefs, metrics)

    // Phase 2
    console.log(`[Phase 2/${TOTAL_PHASES}] Knowledge Loading Stress Test`)
    await phase2KnowledgeLoading(businessDefs, modeConfig.knowledgeDocuments, metrics)

    // Phase 3
    console.log(`[Phase 3/${TOTAL_PHASES}] Conversation Simulation`)
    await phase3Conversations(businessDefs, modeConfig.conversationsPerBusiness, metrics)

    // Phase 4
    console.log(`[Phase 4/${TOTAL_PHASES}] Learning Evolution Test`)
    await phase4LearningEvolution(businessDefs, metrics)

    // Phase 5
    console.log(`[Phase 5/${TOTAL_PHASES}] Mentor Mode Test`)
    await phase5MentorMode(businessDefs, metrics)

    // Phase 6
    console.log(`[Phase 6/${TOTAL_PHASES}] AI Cost Measurement`)
    const costReport = await phase6CostMeasurement(businessDefs, metrics)

    // Phase 7
    console.log(`[Phase 7/${TOTAL_PHASES}] Database Stress & Tenant Isolation`)
    const isolationResult = await phase7DatabaseStress(businessDefs, metrics)

    // Phase 8
    console.log(`[Phase 8/${TOTAL_PHASES}] Time-Lapse Simulation`)
    await phase8TimeLapse(businessDefs, modeConfig.simulatedDays, metrics)

    // Save tracking file
    const bizIds: string[] = []
    for (const b of businessDefs) {
      const id = metrics.getBizId(b.name)
      if (id) bizIds.push(id)
    }
    const trackingFile = saveTrackingFile(bizIds, mode)
    console.log(`\nTracking file: ${trackingFile}`)

    // Generate report
    console.log('\nGenerating report...')
    const reportPath = await generateReport(metrics, mode, costReport, isolationResult, businessDefs)
    console.log(`Report: ${reportPath}`)

    // Summary
    console.log('\n═══════════════════════════════════════')
    console.log('  RESULTS')
    console.log('═══════════════════════════════════════')
    console.log(`  Phases completed: ${metrics.phases.length}/${TOTAL_PHASES}`)
    console.log(`  Total AI calls: ${metrics.totalCalls()}`)
    console.log(`  Total tokens: ${(metrics.totalTokens().input + metrics.totalTokens().output).toLocaleString()}`)
    console.log(`  Estimated cost: $${metrics.totalCost().toFixed(4)}`)
    console.log(`  Failures: ${metrics.failures().length}`)
    console.log(`  Tenant isolation: ${isolationResult.passed ? 'PASSED' : 'FAILED'}`)
    console.log()

    if (metrics.failures().length > 0) {
      console.log('  Failures:')
      for (const f of metrics.failures()) {
        console.log(`    ✗ ${f}`)
      }
    }

    console.log(`\n  Cleanup: npx tsx scripts/scale-test/cleanup.ts`)
  } catch (err) {
    console.error('\nFATAL ERROR:', err instanceof Error ? err.message : String(err))
    exitCode = 1
  }

  process.exit(exitCode)
}

main()