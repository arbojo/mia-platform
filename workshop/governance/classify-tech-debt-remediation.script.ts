import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'TECH-DEBT-REMEDIATION-V01 bounded remediation',
    description:
      'Fix verified debt from TECH-DEBT-V01 register only where bounded and low-risk: TD-001 sync src/lib/types/index.ts outcome unions with migration 025 CHECK (remove cancelled; live DB rejection proven by 23514 incidents pre-CUSTOMER-DATA-V01) + minimal anti-drift test reading migrations; TD-002 cancellation-aware conversion in getSalesMetrics (dashboard/queries.ts:990 excludes sales_cancelled_at via pure helper calculateConversionRate + unit test fixture); TD-007 MemoryPanel renders existing persisted customer data already returned by GET /api/customers/memory (extend select additively with name/phone/email/address). DEFERRED as documented debt: TD-004 protected (active Baileys session), TD-003 resolved-by-documentation (timeline badge is activity indicator: labels Respondido/Pendiente), TD-005/006/008/009/010/011 deferred per remediation policy. No schema changes, no AI behaviour changes, protected bridge files untouched.',
    categories: ['bugfix', 'refactor'],
    filesAffected: 6,
    hasSchemaChanges: false,
    hasAIConsumerChanges: false,
    hasSecurityImplications: false,
    affectedDomains: ['frontend', 'backend'],
  },
]

for (const input of tasks) {
  const result = orchestrator.classify(input)
  console.log()
  console.log(orchestrator.generatePreFlightSummary(result))
  const manifest = workflow.createManifest(input.title, input.description, {
    categories: input.categories,
    filesAffected: input.filesAffected,
    hasSchemaChanges: input.hasSchemaChanges,
    hasAIConsumerChanges: input.hasAIConsumerChanges,
    hasSecurityImplications: input.hasSecurityImplications,
    isCrossCutting: input.affectedDomains.length > 1,
    primaryDomain: 'platform',
    affectedDomains: [],
    technicalDomains: input.affectedDomains,
  }, result)
  console.log(`✓ Manifest created: ${manifest.id} (${manifest.status})`)
}
