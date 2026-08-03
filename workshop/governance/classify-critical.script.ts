import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'
import { AGENT_LABELS } from './types'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const input: OrchestratorInput = {
  title:
    'Corrección crítica: OAuth/business auto-provisión, persistencia de chat y contexto Vitanova',
  description:
    'Concilio ordena: (1) corregir URIs de redirect OAuth y crear business por defecto vía trigger al registrarse por Google; (2) persistir historial de chat en Supabase (conversations/messages) y restaurarlo al recargar; (3) inyectar contexto de Vitanova por defecto en la sesión activa sin configuración manual',
  categories: [
    'bugfix',
    'feature',
    'schema_change',
    'ai_behaviour',
    'api_change',
    'infrastructure',
  ],
  filesAffected: 10,
  hasSchemaChanges: true,
  hasAIConsumerChanges: true,
  hasSecurityImplications: true,
  affectedDomains: ['backend', 'database', 'ai', 'frontend', 'infrastructure'],
}

const result = orchestrator.classify(input)
console.log(orchestrator.generatePreFlightSummary(result))
console.log()

const manifest = workflow.createManifest(input.title, input.description, {
  categories: input.categories,
  filesAffected: input.filesAffected,
  hasSchemaChanges: input.hasSchemaChanges,
  hasAIConsumerChanges: input.hasAIConsumerChanges,
  hasSecurityImplications: input.hasSecurityImplications,
  isCrossCutting: input.affectedDomains.length > 1,
  domains: input.affectedDomains,
}, result)

console.log(`✓ Manifest created: ${manifest.id}`)
console.log(`  Status: ${manifest.status}`)
console.log(`  File: .governance/tasks/${manifest.id}.json`)
console.log()
console.log('  Required agents:')
for (const agent of result.requiredAgents) {
  console.log(`    → ${AGENT_LABELS[agent] ?? agent}`)
}
