import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'INVARIANT-REGISTRY-V01 seed artifact',
    description:
      'Create .governance/invariants.json (17 evidence-backed invariant entries derived from AGENTS.md sections 5/9/22/23/24, migrations, sales runtime code and confirmed findings from TECH-DEBT-V01/CUSTOMER-DATA-V01 loops) plus a minimal structure-contract unit test validating IDs/enums/sources/failure_behavior. Governance-artifact mission only: no product code changes.',
    categories: ['documentation'],
    filesAffected: 3,
    hasSchemaChanges: false,
    hasAIConsumerChanges: false,
    hasSecurityImplications: false,
    affectedDomains: ['platform'],
  },
]

for (const input of tasks) {
  const result = orchestrator.classify(input)
  console.log()
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
  console.log(`✓ Manifest created: ${manifest.id} (${manifest.status}) complexity=${result.complexity}`)
}
