import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Medios por Producto: product_id en multimedia + selector UI + product_context en sesion',
    description:
      'Asociar knowledge_items multimedia a un producto del catalogo mediante product_id (FK nullable a products), anadir selector de producto en el formulario "Subir nuevo medio" y en edicion de la Media Library, hacer que resolveConditionalMedia escale por product_context, e inyectar product_context de forma invisible en la sesion de chat (landing/widget, campanas Facebook y anclas publicitarias) para que el matcher de medios y el prompt usen el producto activo.',
    categories: ['feature', 'schema_change', 'ai_behaviour', 'ui_change', 'api_change'],
    filesAffected: 10,
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
    domains: input.affectedDomains,
  }, result)
  console.log(`✓ Manifest created: ${manifest.id} (${manifest.status})`)
}
