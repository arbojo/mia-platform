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
    missionId: 'ENVIRONMENT-DRIFT-RESOLUTION-V01',
    objective:
      'Determine by evidence alone whether the foreign session ended; release drift safely ONLY with explicit release evidence; then revalidate global gates.',
    scopeSummary:
      'read-only forensics over protected paths, stash, merge-state; zero product modifications; global gates revalidation only after confirmed release',
    parentMissionId: 'MIA-FUNCTIONAL-INTEGRITY-V01',
    resumePoint: null,
  },
  checkpoint: null,
  registry: { invariantIds: Array.from({ length: 18 }, (_, i) => String(i)) },
  observedForeignPaths: PROTECTED,
  declaredProtectedPaths: PROTECTED,
})

console.log(`CONTEXT CHECK: ${report.status} missing=[${report.missing.join(',')}] parent=${report.parentMissionId}`)

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()
const input: OrchestratorInput = {
  title: 'ENVIRONMENT-DRIFT-RESOLUTION-V01 foreign session forensics',
  description:
    'Evidence-only determination of foreign session liveness (mtimes, merge-state, stash age, remote movement); STOP_FOR_HUMAN unless FOREIGN_SESSION_RELEASED; safe tree release and global gate revalidation only after explicit release evidence.',
  categories: ['documentation'],
  filesAffected: 1,
  hasSchemaChanges: false,
  hasAIConsumerChanges: false,
  hasSecurityImplications: false,
  affectedDomains: ['platform'],
}
const result = orchestrator.classify(input)
const manifest = workflow.createManifest(
  input.title,
  input.description,
  {
    categories: input.categories,
    filesAffected: input.filesAffected,
    hasSchemaChanges: false,
    hasAIConsumerChanges: false,
    hasSecurityImplications: false,
    isCrossCutting: false,
    primaryDomain: 'platform',
    affectedDomains: ['platform'],
    technicalDomains: ['backend'],
  },
  result
)
console.log(`✓ ${manifest.id} (${manifest.status}) complexity=${result.complexity}`)
