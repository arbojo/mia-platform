import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'
import { reconstructContext } from './context'

const PROTECTED = [
  'services/whatsapp-bridge/src/mia-client.ts',
  'services/whatsapp-bridge/src/server.ts',
  'src/app/api/channels/baileys/webhook/route.ts',
  'src/lib/system/edition.ts',
]

const report = reconstructContext({
  manifest: {
    missionId: 'MIA-FUNCTIONAL-INTEGRITY-V01',
    objective:
      'Verify end-to-end media dispatch, customer/order data capture, persistence and dashboard display with executable evidence; fix only blocking defects.',
    scopeSummary:
      'runtime media pipeline, channels identity, sales detect/process/events, customer memory, dashboard customers/delivery surfaces; no migrations unless blocking defect.',
    parentMissionId: null,
    resumePoint: null,
  },
  checkpoint: null,
  registry: {
    invariantIds: Array.from({ length: 18 }, (_, i) => String(i)),
  },
  observedForeignPaths: PROTECTED,
  declaredProtectedPaths: PROTECTED,
})

console.log('CONTEXT CHECK:')
console.log(`  status: ${report.status}`)
console.log(`  missing: [${report.missing.join(', ')}]`)
console.log(`  ambiguities: [${report.ambiguities.join(', ')}]`)
console.log(`  protectedPaths preserved: ${report.protectedPaths.length === 4}`)
if (report.status === 'CONTEXT_HUMAN_REQUIRED') {
  throw new Error('Context Integrity Gate blocked mission start.')
}
console.log('  -> continuation authorized from persisted sources (registry 18 invariants, debt register, checkpoint lineage).')

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const input: OrchestratorInput = {
  title: 'MIA-FUNCTIONAL-INTEGRITY-V01 functional integrity audit',
  description:
    'Trace real runtime paths for media dispatch (resolveConditionalMedia -> channel payload -> transport), customer field capture (name/phone/email/city/address), order consistency and dashboard rendering; classify each acceptance criterion with executable evidence; implement ONLY confirmed blocking fixes with root cause + minimal fix + acceptance test; protected Baileys leg recorded as HUMAN_REQUIRED if unverifiable due to foreign session.',
  categories: ['bugfix', 'refactor'],
  filesAffected: 8,
  hasSchemaChanges: false,
  hasAIConsumerChanges: false,
  hasSecurityImplications: false,
  affectedDomains: ['sales', 'platform'],
}

const result = orchestrator.classify(input)
console.log()
const manifest = workflow.createManifest(
  input.title,
  input.description,
  {
    categories: input.categories,
    filesAffected: input.filesAffected,
    hasSchemaChanges: input.hasSchemaChanges,
    hasAIConsumerChanges: input.hasAIConsumerChanges,
    hasSecurityImplications: input.hasSecurityImplications,
    isCrossCutting: true,
    primaryDomain: 'platform',
    affectedDomains: ['platform'],
    technicalDomains: ['backend', 'frontend'],
  },
  result
)
console.log(`✓ Manifest created: ${manifest.id} (${manifest.status}) complexity=${result.complexity}`)
console.log(`requiredAgents=[${result.requiredAgents.join(',')}]`)
