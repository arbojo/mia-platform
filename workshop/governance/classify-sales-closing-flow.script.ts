import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Flujo de cierre de pedido completo: deteccion IA, sales_events, notificacion y metricas',
    description:
      'Implementar el flujo de cierre de pedido end-to-end: (1) deteccion de cierre/outcome por IA al procesar mensajes entrantes (gpt-4o-mini, clasificacion compacta), (2) tabla sales_events con el enum ADR-010 (SALE_WON, SALE_LOST, PRODUCT_SELECTED, etc.) + RLS, (3) actualizacion de conversations.outcome/deal_value y customers.status/address al cerrar, (4) emision de datos de pago/envio por MIA via prompt y regla payment/askCity, (5) notificacion al humano via mia_signals (tipo SALES, priority atencion) y MIAInbox conectado a datos reales, (6) metricas de venta (conversion, revenue, ventas hoy) via GET /api/sales/metrics y tarjeta en dashboard, (7) endpoint PATCH /api/conversations/[id]/outcome para override manual. Incluye migracion 025_sales_events.sql, tipos TS alineados, y rutas API nuevas.',
    categories: ['feature', 'schema_change', 'ai_behaviour', 'api_change'],
    filesAffected: 15,
    hasSchemaChanges: true,
    hasAIConsumerChanges: true,
    hasSecurityImplications: true,
    affectedDomains: ['frontend', 'backend', 'database', 'ai', 'infrastructure'],
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
