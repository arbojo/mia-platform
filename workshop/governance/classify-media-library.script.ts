import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Multimedia Inteligente: media library y media_type sobre ADR-014',
    description:
      'Extender el sistema de Conditional Knowledge Media (ADR-014) sin crear tablas paralelas. Añadir columna media_type (image/testimonial/flyer/other) a knowledge_items, persistirlo en el API de items (POST/PATCH), retornarlo en resolveConditionalMedia, y crear dashboard de Media Library en el panel: listar assets con imagen, filtrar por tipo, subir imágenes (reusa /api/knowledge/media/upload), editar descripción/trigger/tipo y eliminar. Mejorar el matcher de triggers para soportar varios términos.',
    categories: ['feature', 'schema_change', 'ai_behaviour', 'ui_change'],
    filesAffected: 8,
    hasSchemaChanges: true,
    hasAIConsumerChanges: true,
    hasSecurityImplications: false,
    affectedDomains: ['database', 'backend', 'frontend', 'ai'],
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
    affectedDomains: [],
    technicalDomains: input.affectedDomains,
  }, result)
  console.log(`✓ Manifest created: ${manifest.id} (${manifest.status})`)
}
