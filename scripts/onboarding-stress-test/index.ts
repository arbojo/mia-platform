import { config } from 'dotenv'
config({ path: '.env.local' })
import * as fs from 'fs'
import * as path from 'path'
import { getSupabase, getOpenAI, calculateCost, elapsedMs, formatDuration, MetricsCollector, classifyWithLLM } from './utils'
import { generateDocuments, getConflictPairs, TOTAL_DOCUMENTS, TEST_BUSINESS_NAME, TEST_OWNER_ID } from './config'
import { generateReport } from './report'

const PHASES = ['Business Setup', 'Document Ingestion', 'Conflict Detection', 'Readiness Evaluation', 'Cost Analysis', 'Report Generation']
const IS_SAFE = process.argv.includes('--safe')

async function main() {
  console.log('╔═══════════════════════════════════════════╗')
  console.log('║  MIA ONBOARDING STRESS TEST                ║')
  if (IS_SAFE) console.log('║  🔒 SAFE MODE — 5 documents only             ║')
  console.log('║  Real Business Import Simulation            ║')
  console.log('╚═══════════════════════════════════════════╝\n')

  const metrics = new MetricsCollector()
  const supabase = getSupabase()
  const openai = getOpenAI()
  const allDocuments = generateDocuments()
  const documents = IS_SAFE ? allDocuments.slice(0, 5) : allDocuments
  const conflictPairs = getConflictPairs()

  console.log(`Mode: ${IS_SAFE ? '🔒 SAFE' : 'FULL'}`)
  console.log(`Business: ${TEST_BUSINESS_NAME}`)
  console.log(`Documents: ${documents.length} (${documents.filter(d => d.isConflict).length} conflict injections)`)
  console.log(`Conflict pairs: ${IS_SAFE ? '0 (disabled in SAFE mode)' : conflictPairs.length}`)
  console.log()

  // Phase 1: Business Setup
  console.log(`[1/${PHASES.length}] ${PHASES[0]}`)
  const { data: biz, error: bizErr } = await supabase
    .from('businesses').insert({ owner_id: TEST_OWNER_ID, name: TEST_BUSINESS_NAME, onboarding_status: 'created' }).select().single()
  if (bizErr) { console.error(`  ✗ Business creation failed: ${bizErr.message}`); process.exit(1) }
  console.log(`  ✓ Business created: ${biz.id}`)

  const { data: asst, error: asstErr } = await supabase
    .from('assistants').insert({ business_id: biz.id, name: 'ImportBot', personality: { warmth: 50, formality: 50, humor: 30, sales_aggressiveness: 50 }, communication_style: 'formal', is_active: true })
    .select().single()
  if (asstErr) { console.error(`  ✗ Assistant creation failed: ${asstErr.message}`); process.exit(1) }
  console.log(`  ✓ Assistant created: ${asst.id}`)

  await supabase.from('brand_identities').insert({
    business_id: biz.id, business_name: 'ImportCorp S.A. de C.V.',
    tagline: 'Soluciones empresariales integrales',
    target_customers: 'Empresas medianas y grandes en México y LATAM',
    differentiators: 'Soporte 24/7, garantía extendida, precios competitivos',
    elevator_pitch: 'ImportCorp ofrece soluciones tecnológicas empresariales con el mejor soporte del mercado.',
    tone_of_voice: 'Profesional y confiable',
  })
  console.log(`  ✓ Brand identity created`)

  metrics.setBizIds(biz.id, asst.id)
  console.log()

  // Phase 2: Document Ingestion
  console.log(`[2/${PHASES.length}] ${PHASES[1]}`)
  let processed = 0
  let conflictsDetected = 0

  for (const doc of documents) {
    const start = Date.now()
    try {
      const result = await classifyWithLLM(doc, openai)
      const inputTokens = 350 + Math.ceil(doc.content.length / 4)
      const outputTokens = 300

      metrics.recordExtraction({
        docId: doc.id,
        title: doc.title,
        type: doc.type,
        category: result.category,
        inputTokens,
        outputTokens,
        cost: calculateCost('gpt-4o-mini', inputTokens, outputTokens),
        durationMs: elapsedMs(start),
        success: true,
        extractedContent: JSON.stringify(result.entities.slice(0, 3)),
      })

      // Store entities in correct tables
      for (const entity of result.entities) {
        const d = entity.data as Record<string, unknown>

        const mapField = (aliases: string[], fallback: unknown): unknown => {
          for (const a of aliases) { if (d[a] !== undefined && d[a] !== null) return d[a] }
          return fallback
        }
        const toNum = (v: unknown): number => {
          if (typeof v === 'number') return v
          if (typeof v === 'string') return parseFloat(v.replace(/[^0-9.-]/g, '')) || 0
          return 0
        }
        const toString = (v: unknown): string => (v && typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''))

        const knownKiCats = ['faq', 'process', 'tip', 'business_info', 'objection']
        const knownSrCats = ['zones', 'payment', 'schedule', 'promotions', 'restrictions', 'escalation']
        const knownBmCats = ['customer_behavior', 'product_performance', 'sales_pattern', 'objection_trend', 'faq_frequency', 'delivery_question', 'payment_question', 'warranty_question', 'pricing_question', 'competition_question']
        const knownBmTypes = ['pattern', 'experience', 'insight', 'trend']

        let res: { error: unknown } = { error: null }
        try {
          if (entity.table === 'products') {
            res = await supabase.from('products').insert({
              business_id: biz.id, is_active: true,
              name: toString(mapField(['name', 'nombre', 'product_name', 'producto'], 'Producto')),
              price: toNum(mapField(['price', 'precio', 'cost', 'costo'], 0)),
              description: toString(mapField(['description', 'descripcion', 'desc', 'details', 'detalles'], '')),
              benefits: toString(mapField(['benefits', 'beneficios', 'benefit'], '')),
            })
          } else if (entity.table === 'knowledge_items') {
            const cat = toString(mapField(['category', 'categoria'], 'faq'))
            res = await supabase.from('knowledge_items').insert({
              business_id: biz.id, source: 'document', confidence: 'high', is_active: true,
              category: knownKiCats.includes(cat) ? cat : 'faq',
              question: toString(mapField(['question', 'pregunta', 'q', 'topic', 'tema'], '')),
              answer: toString(mapField(['answer', 'respuesta', 'a', 'response', 'content', 'contenido'], '')),
            })
          } else if (entity.table === 'sales_rules') {
            const cat = toString(mapField(['category', 'categoria', 'type', 'tipo'], 'restrictions'))
            const content = toString(mapField(['content', 'contenido', 'rule', 'regla', 'policy', 'description', 'descripcion', 'text', 'texto'], ''))
            res = await supabase.from('sales_rules').insert({
              business_id: biz.id, is_active: true,
              category: knownSrCats.includes(cat) ? cat : 'restrictions',
              content,
              priority: toNum(mapField(['priority', 'prioridad', 'importance'], 5)),
            })
          } else if (entity.table === 'ai_instructions') {
            let instruction = toString(mapField(['instruction', 'instruccion', 'instructions', 'instrucciones', 'text', 'texto'], ''))
            if (Array.isArray(d.instruction) || Array.isArray(d.instructions) || Array.isArray(d.instrucciones)) {
              const arr = (d.instruction ?? d.instructions ?? d.instrucciones ?? []) as string[]
              instruction = arr.join('. ')
            }
            res = await supabase.from('ai_instructions').insert({
              business_id: biz.id, source: 'onboarding', is_active: true,
              instruction,
              priority: toNum(mapField(['priority', 'prioridad'], 5)),
            })
          } else if (entity.table === 'business_memory') {
            const memType = toString(mapField(['memory_type', 'type', 'tipo'], 'insight'))
            const cat = toString(mapField(['category', 'categoria'], 'customer_behavior'))
            res = await supabase.from('business_memory').insert({
              business_id: biz.id, is_active: true, evidence: {}, confidence: 50,
              memory_type: knownBmTypes.includes(memType) ? memType : 'insight',
              category: knownBmCats.includes(cat) ? cat : 'customer_behavior',
              content: toString(mapField(['content', 'contenido', 'description', 'descripcion', 'text', 'texto', 'memo', 'note'], '')),
            })
          }
        } catch (storeErr) {
          metrics.recordFailure(`Store exception for ${doc.id}[${entity.table}]: ${storeErr instanceof Error ? storeErr.message : String(storeErr)}`)
        }
        if (res.error) {
          const errMsg = (res.error as { message?: string }).message ?? String(res.error)
          metrics.recordFailure(`Store error for ${doc.id}[${entity.table}]: ${errMsg}`)
        }
      }

      // Track conflict detection
      if (doc.isConflict && result.conflicts.length > 0) {
        conflictsDetected++
      }

      processed++
    } catch (err) {
      metrics.recordExtraction({
        docId: doc.id, title: doc.title, type: doc.type, category: 'error',
        inputTokens: 0, outputTokens: 0, cost: 0, durationMs: elapsedMs(start),
        success: false, error: err instanceof Error ? err.message : String(err),
      })
      metrics.recordFailure(`Extraction failed: ${doc.title}: ${err instanceof Error ? err.message : String(err)}`)
    }

    if (processed % 10 === 0) {
      const tok = metrics.totalTokens()
      console.log(`  ${processed}/${documents.length} | tokens: ${(tok.input + tok.output).toLocaleString()} | cost: $${metrics.totalCost().toFixed(4)} | failures: ${metrics.failures.length}`)
    }
  }

  console.log(`  ✓ ${processed} documents processed`)
  console.log(`  ✓ Conflicts detected by LLM: ${conflictsDetected}/${documents.filter(d => d.isConflict).length}`)
  console.log()

  // Phase 3: Conflict Detection (verification)
  console.log(`[3/${PHASES.length}] ${PHASES[2]}`)
  for (const pair of conflictPairs) {
    const { data: existing } = await supabase
      .from('sales_rules').select('content').eq('business_id', biz.id).ilike('content', `%${pair.docA.slice(0, 20)}%`).limit(1)
    const { data: existing2 } = await supabase
      .from('sales_rules').select('content').eq('business_id', biz.id).ilike('content', `%${pair.docB.slice(0, 20)}%`).limit(1)

    console.log(`  Pair: ${pair.docA} ↔ ${pair.docB}`)
    console.log(`    Type: ${pair.type}`)
    console.log(`    A stored: ${(existing?.length ?? 0) > 0 ? 'yes' : 'no'}`)
    console.log(`    B stored: ${(existing2?.length ?? 0) > 0 ? 'yes' : 'no'}`)
    console.log(`    LLM detected: ${conflictsDetected > 0 ? 'yes' : 'partial'}`)
  }
  console.log()

  // Phase 4: Readiness Evaluation
  console.log(`[4/${PHASES.length}] ${PHASES[3]}`)
  const { count: prodCount } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('business_id', biz.id)
  const { count: knowCount } = await supabase.from('knowledge_items').select('*', { count: 'exact', head: true }).eq('business_id', biz.id)
  const { count: ruleCount } = await supabase.from('sales_rules').select('*', { count: 'exact', head: true }).eq('business_id', biz.id)
  const { count: instCount } = await supabase.from('ai_instructions').select('*', { count: 'exact', head: true }).eq('business_id', biz.id)
  const { count: memoCount } = await supabase.from('business_memory').select('*', { count: 'exact', head: true }).eq('business_id', biz.id)

  const totalItems = (prodCount ?? 0) + (knowCount ?? 0) + (ruleCount ?? 0) + (instCount ?? 0) + (memoCount ?? 0)
  const coverage = {
    products: { count: prodCount ?? 0, target: 8, pct: Math.min(100, Math.round(((prodCount ?? 0) / 8) * 100)) },
    knowledge: { count: knowCount ?? 0, target: 16, pct: Math.min(100, Math.round(((knowCount ?? 0) / 16) * 100)) },
    rules: { count: ruleCount ?? 0, target: 14, pct: Math.min(100, Math.round(((ruleCount ?? 0) / 14) * 100)) },
    instructions: { count: instCount ?? 0, target: 4, pct: Math.min(100, Math.round(((instCount ?? 0) / 4) * 100)) },
    memory: { count: memoCount ?? 0, target: 4, pct: Math.min(100, Math.round(((memoCount ?? 0) / 4) * 100)) },
  }

  const avgCoverage = Math.round(Object.values(coverage).reduce((s, c) => s + c.pct, 0) / 5)
  const errors = metrics.failures.length
  const conflictsFound = conflictsDetected
  const totalConflicts = documents.filter(d => d.isConflict).length
  const conflictRate = totalConflicts > 0 ? Math.round((conflictsFound / totalConflicts) * 100) : 0
  const errorRate = documents.length > 0 ? Math.round((errors / documents.length) * 100) : 0

  let readiness: 'raw' | 'basic' | 'developing' | 'advanced' | 'mature'
  let maturity = 0
  if (avgCoverage < 30 || errorRate > 50) { readiness = 'raw'; maturity = 1 }
  else if (avgCoverage < 50 || errorRate > 20) { readiness = 'basic'; maturity = 2 }
  else if (avgCoverage < 70 || conflictRate < 50) { readiness = 'developing'; maturity = 3 }
  else if (avgCoverage < 90) { readiness = 'advanced'; maturity = 4 }
  else { readiness = 'mature'; maturity = 5 }

  Object.entries(coverage).forEach(([k, v]) => {
    console.log(`  ${k.padEnd(15)} ${v.count}/${v.target} (${v.pct}%)`)
  })
  console.log(`  Average coverage: ${avgCoverage}%`)
  console.log(`  Error rate: ${errorRate}%`)
  console.log(`  Conflict detection: ${conflictRate}%`)
  console.log(`  Readiness: ${readiness.toUpperCase()} (Stage ${maturity}/5)`)
  console.log()

  // Phase 5: Cost Analysis
  console.log(`[5/${PHASES.length}] ${PHASES[4]}`)
  const tot = metrics.totalTokens()
  const totCost = metrics.totalCost()
  const avgCostPerDoc = documents.length > 0 ? totCost / documents.length : 0
  console.log(`  Total API calls: ${metrics.extractionRecords.length}`)
  console.log(`  Total tokens: ${(tot.input + tot.output).toLocaleString()} (input: ${tot.input.toLocaleString()}, output: ${tot.output.toLocaleString()})`)
  console.log(`  Total cost: $${totCost.toFixed(4)}`)
  console.log(`  Avg cost/doc: $${avgCostPerDoc.toFixed(6)}`)

  const projections = {
    small: { docs: 50, cost: avgCostPerDoc * 50, label: 'Pequeño' },
    medium: { docs: 200, cost: avgCostPerDoc * 200, label: 'Mediano' },
    enterprise: { docs: 1000, cost: avgCostPerDoc * 1000, label: 'Enterprise' },
  }
  for (const [k, v] of Object.entries(projections)) {
    console.log(`  Projection ${v.label} (${v.docs} docs): $${v.cost.toFixed(2)}/mes`)
  }
  console.log()

  // Phase 6: Report
  console.log(`[6/${PHASES.length}] ${PHASES[5]}`)
  const reportPath = generateReport(metrics, documents, conflictPairs, coverage, readiness, maturity, projections, biz.id)
  console.log(`  Report: ${reportPath}\n`)

  // Summary
  console.log('═══════════════════════════════════════')
  console.log('  RESULTS')
  console.log('═══════════════════════════════════════')
  console.log(`  Duration: ${formatDuration(metrics.elapsed())}`)
  console.log(`  Documents processed: ${processed}/${documents.length}`)
  console.log(`  Extraction failures: ${metrics.failures.length}`)
  console.log(`  Total items stored: ${totalItems}`)
  console.log(`  Readiness: ${readiness.toUpperCase()} (Stage ${maturity}/5)`)
  console.log(`  Conflicts detected: ${conflictsFound}/${totalConflicts}`)
  console.log(`  Total cost: $${totCost.toFixed(4)}`)
  console.log(`  Avg cost/doc: $${avgCostPerDoc.toFixed(6)}`)
  console.log()

  // Persist test metadata
  const trackingFile = path.join(__dirname, `.onboarding-${TEST_BUSINESS_NAME.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`)
  fs.writeFileSync(trackingFile, JSON.stringify({ businessId: biz.id, assistantId: asst.id, timestamp: new Date().toISOString(), mode: 'stress-test', documents: documents.length }, null, 2))
  console.log(`Tracking: ${trackingFile}`)
  console.log(`Cleanup: npx tsx scripts/onboarding-stress-test/cleanup.ts`)
  console.log()
}

main().catch(console.error)
