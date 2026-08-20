import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'
import type { BusinessDomain } from './types'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Experience Memory — Modelo C 70/30: Migración + API + Prompt + UI + Tests',
    description:
      'Implementar el motor completo de Experience Memory para el dominio Sales: sistema de memoria acumulada de objeciones con modelo C híbrido (70% Global/Industria, 30% Negocio). La migración 053, blender, suggester, PATCH endpoint, tipos y 11 tests ya existen (commit 3fd5154). Falta: seed data de patrones, API routes GET/POST, integración con prompt builder, frontend UI "Tinder de Objeciones", y tests e2e. Blueprint completo en .agents/experience-memory-blueprint-v4.md.',
    categories: ['feature', 'schema_change', 'api_change', 'ai_behaviour', 'ui_change'],
    filesAffected: 10,
    hasSchemaChanges: true,
    hasAIConsumerChanges: true,
    hasSecurityImplications: true,
    affectedDomains: ['sales', 'platform'],
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
    primaryDomain: 'sales',
    affectedDomains: input.affectedDomains as BusinessDomain[],
    technicalDomains: ['backend', 'frontend', 'database', 'ai'],
  }, result)
  console.log(`V Manifest created: ${manifest.id} (${manifest.status})`)
  console.log(`  Required agents: ${result.requiredAgents.join(', ')}`)
  console.log(`  Quality gates: ${result.qualityGates.join(', ')}`)
}
