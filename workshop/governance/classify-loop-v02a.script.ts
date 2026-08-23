import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'
import type { BusinessDomain } from './types'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Engineering Loop v0.2a - Accountable Handoff: Subaru obligatorio, precondicion de governance e INFRA_FAILURE',
    description:
      'Cerrar D1 del post-proof audit y anadir dos salvaguardas deterministicas al Engineering Loop. (1) Gateway Subaru obligatorio en toda escalada: sin gateway configurado o si checkpointEscalation falla, la mision termina en BLOCK con evidencia ESCALATION_UNRECORDED y NUNCA se invoca al fallback (invariante NO CHECKPOINT -> NO HANDOFF); evidencia distingue ESCALATION_CHECKPOINTED de ESCALATION_UNRECORDED. (2) Precondicion de governance: runMission exige governanceTaskId con manifest aprobado (FileGovernanceChecker sobre .governance/tasks) antes de invocar OpenCode, seleccionar worker o tocar codigo; manifiesto ausente/rechazado/no-aprobado/malformado produce GOVERNANCE_REFUSED + BLOCK con cero llamadas al worker (invariante NO APPROVED GOVERNANCE -> NO WORKER). (3) Clasificacion INFRA_FAILURE: status null o errores de spawn ENOENT/EACCES se clasifican como fallo de infraestructura, no reintentan worker ni disparan handoff (invariante INFRA_FAILURE -> NO WORKER SWITCH). Alcance: workshop/loop/{runner,signals,governance,subaru-gateway,run-loop}.ts + tests/engineering-loop.test.ts + drill real + docs. Fuera de alcance: D2 (reparacion de gates), D3 (validacion de output), rollback, pools dinamicos, budgets, deployment.',
    categories: ['infrastructure', 'feature'],
    filesAffected: 7,
    hasSchemaChanges: false,
    hasAIConsumerChanges: false,
    hasSecurityImplications: true,
    affectedDomains: ['platform'],
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
    isCrossCutting: false,
    primaryDomain: 'platform',
    affectedDomains: input.affectedDomains as BusinessDomain[],
    technicalDomains: ['backend', 'infrastructure'],
  }, result)
  console.log(`V Manifest created: ${manifest.id} (${manifest.status})`)
}
