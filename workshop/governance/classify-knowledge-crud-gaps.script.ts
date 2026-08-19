import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title:
      'Cerrar gaps del CRUD de Knowledge Base: reflejo inmediato del bot, activar/desactivar y versionado auditable',
    description:
      'EVIDENCIA: el modulo de Knowledge Base CRUD ya existe en el repo (no se reconstruye): tabla knowledge_items con category/question/answer/source/confidence/is_active/created_at/updated_at; endpoints /api/knowledge/items (GET filtrado por business_id/category/search/media/product_id y POST) y /api/knowledge/items/[id] (GET/PATCH/DELETE con soft-delete is_active=false); UI /dashboard/knowledge -> KnowledgeCenter -> KnowledgeManager (tarjetas, formulario de alta, KnowledgeItemDialog de edicion, AlertDialog de confirmacion de borrado, busqueda y filtro); integracion RAG: getBusinessContext (src/lib/ai/knowledge.ts:56-61) inyecta knowledge_items activos al prompt via loadConversationContext (src/lib/conversation/context.ts, cache TTL 5 min). DISENO para cerrar 3 gaps reales vs el pedido del negocio: (1) REFLEJO INMEDIATO: loadConversationContext mantiene cache en memoria con TTL 5 min (context.ts:29-37), por lo que un PATCH no se refleja en /api/chat ni en el bridge hasta 5 min. Se exporta invalidateConversationContext(businessId) (limpiar solo la clave del negocio) y se invoca en POST/PATCH/DELETE de knowledge_items para reflejo inmediato SIN cambiar prompt ni comportamiento de IA. (2) ACTIVAR/DESACTIVAR sin perder visibilidad: hoy DELETE desactiva pero no se puede ver ni reactivar (GET solo lista is_active=true). GET /api/knowledge/items acepta status=active|inactive|all (default active: no rompe consumidores actuales); PATCH acepta is_active para reactivar/desactivar; UI: badge de estado, boton Desactivar/Activar y filtro de estado en KnowledgeManager. (3) VERSIONADO/AUDITORIA: knowledge_versions (tabla existente, hoy solo escrita por laboratorio/teach) se escribe tambien en cada PATCH de knowledge_items con entity_type=knowledge_item, previous_value/new_value, changed_by=user.id, change_source=manual, dando single source of truth auditable. SIN migraciones SQL (no se agregan columnas; knowledge_versions ya existe). RLS intacta (admin client scoped a business_id; validacion de ownership existente en los endpoints). Archivos: src/app/api/knowledge/items/route.ts, src/app/api/knowledge/items/[id]/route.ts, src/lib/conversation/context.ts, src/components/knowledge/KnowledgeManager.tsx, tests/api/knowledge-items.test.ts, tests/context/load-context.test.ts.',
    categories: ['feature', 'api_change', 'ui_change'],
    filesAffected: 6,
    hasSchemaChanges: false,
    hasAIConsumerChanges: true,
    hasSecurityImplications: false,
    affectedDomains: ['backend', 'frontend', 'ai'],
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
