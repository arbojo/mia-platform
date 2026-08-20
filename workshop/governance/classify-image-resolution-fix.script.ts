import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'
import type { BusinessDomain } from './types'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Fix imagen incorrecta — resolveRecommendedProduct no resuelve productId por nombre, conditional-media devuelve genéricos de otros productos',
    description:
      'Cuando el usuario pregunta por un producto específico (ej. "información del Clean Nails"), la imagen que aparece es de otro producto (Neurotin). Dos causas: (1) resolveRecommendedProduct solo resuelve productId via landing context, trigger de knowledge_items, o intent de catálogo/precio — no matchea por nombre de producto en el mensaje. Fix: agregar paso 2b que busque productos activos cuyo nombre normalizado aparezca en el mensaje, retornando si hay exactamente 1 match. (2) resolveConditionalMedia cuando conoce el productId aún cae a knowledge_items genéricos (product_id=NULL) que pueden tener imagen de otro producto. Fix: cuando productId es conocido, solo servir imagen de ese producto, nunca genéricos. Cambios en product-recommendation.ts (nuevo paso 2b con normalizeText) y conditional-media.ts (eliminación de fallback a genéricos). Tests actualizados.',
    categories: ['bugfix'],
    filesAffected: 2,
    hasSchemaChanges: false,
    hasAIConsumerChanges: false,
    hasSecurityImplications: false,
    affectedDomains: ['sales'],
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
    technicalDomains: ['backend'],
  }, result)
  console.log(`✓ Manifest created: ${manifest.id} (${manifest.status})`)
}
