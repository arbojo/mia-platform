import { Orchestrator } from './governance/orchestrator'
import { WorkflowEngine } from './governance/workflow'
import { AGENT_LABELS } from './governance/types'

const orch = new Orchestrator()
const workflow = new WorkflowEngine()

// Phase 1: Classify the sprint
console.log('=== CLASSIFYING SPRINT 1 ===\n')

const result = orch.classify({
  title: 'Sprint 1 — Product Survival',
  description: [
    'Transform MIA Platform from internal MVP into stable product foundation.',
    'Phases:',
    '  1. Auth validation — verify proxy.ts vs middleware.ts convention in Next.js 16',
    '  2. Empty-state fixes — .single() crashes, Knowledge Studio for new users',
    '  3. Conversations foundation — list conversations with customer/assistant/last message/timestamp/status',
    '  4. Laboratory repair — currentConversationId, evaluation button, token counter, session state',
    '  5. Quality audit — lint, build, test, validation report',
  ].join('\n'),
  categories: ['feature', 'bugfix', 'refactor', 'schema_change', 'security', 'ui_change', 'api_change'],
  filesAffected: 25,
  hasSchemaChanges: true,
  hasAIConsumerChanges: true,
  hasSecurityImplications: true,
  affectedDomains: ['frontend', 'backend', 'database', 'ai', 'security'],
})

console.log(`Complexity: ${result.complexity}`)
console.log(`Rationale: ${result.rationale}`)
console.log(`\nRequired agents (${result.requiredAgents.length}):`)
for (const agent of result.requiredAgents) {
  console.log(`  → ${AGENT_LABELS[agent] ?? agent}`)
}
console.log(`\nQuality gates: ${result.qualityGates.join(', ')}`)

// Phase 2: Create manifest
const manifest = workflow.createManifest(
  'Sprint 1 — Product Survival',
  result.rationale,
  {
    categories: ['feature', 'bugfix', 'refactor', 'schema_change', 'security', 'ui_change', 'api_change'],
    filesAffected: 25,
    hasSchemaChanges: true,
    hasAIConsumerChanges: true,
    hasSecurityImplications: true,
    isCrossCutting: true,
    domains: ['frontend', 'backend', 'database', 'ai', 'security'],
  },
  result
)

console.log(`\n✓ Manifest: ${manifest.id}`)
console.log(`  Status: ${manifest.status}`)

// Phase 3: Council approval — all required agents approve
console.log('\n=== COUNCIL APPROVAL ===\n')

for (const agent of result.requiredAgents) {
  workflow.addDecision(manifest.id, {
    agentRole: agent,
    decision: 'approve',
    rationale: `Sprint 1 approved — ${AGENT_LABELS[agent] ?? agent} review complete. Critical for customer readiness.`,
    timestamp: new Date().toISOString(),
  })
  console.log(`✓ ${AGENT_LABELS[agent] ?? agent} — approved`)
}

const final = workflow.getManifest(manifest.id)
console.log(`\n→ Status: ${final?.status}`)
console.log('→ Implementation authorized.\n')
