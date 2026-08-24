import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'INVARIANT-VERIFICATION-V01 mechanical verification',
    description:
      'Verify the 17 registered invariants with real evidence (test runs, migration history forensics, counter-evidence sweeps) producing PASS/FAIL/UNKNOWN/HUMAN_REQUIRED records; close the verified gap where WorkflowEngine.addQualityResult only logs and transition-to-completed never checks gates; add minimal complete() guard enforcing UNKNOWN != PASS for declared applicableInvariants plus recorded gate results; add record-gate/record-invariant CLI commands; add stateless context-integrity reconstruction helper reusing governance manifests + Subaru checkpoint frontmatter; behavior tests A-J. Governance tooling scope only: no product/runtime/dashboard changes.',
    categories: ['infrastructure'],
    filesAffected: 8,
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
  console.log(`requiredAgents=[${result.requiredAgents.join(',')}]`)
}
