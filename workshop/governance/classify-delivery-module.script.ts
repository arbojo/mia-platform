import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'
import type { BusinessDomain } from './types'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Módulo Delivery Autónomo — App repartidor, geofencing, motor de rutas nativo, IA de re-enrutamiento y dashboard financiero',
    description:
      'Sistema de gestión de entregas 100% nativo bajo ADR-025. Incluye: (1) Base de datos independiente (delivery_routes, delivery_stops con estados pending/in_progress/delivered/rescheduled/rejected, delivery_finances). (2) Motor de geofencing con listener GPS en segundo plano, cruce de polígonos (800m/10m) y mutación automática de estados. (3) Re-enrutamiento automático por timeout. (4) App del repartidor: vista monobloque optimizada para una mano, tarjeta activa gigante, botones de acción rápida, visor de mapas nativo con OSRM, llamada directa tel:, cámara nativa con estampa de coordenadas/hora y selector de receptor. (5) Dashboard financiero en tiempo real: contador progreso, efectivo en mano, ganancia, proyección, efectividad, historial semanal. (6) Confirmaciones matutinas con templates por huso horario. (7) IA para negociación de horarios cerrados y re-enrutamiento. Cero dependencias de SDKs de terceros.',
    categories: ['feature', 'infrastructure'],
    filesAffected: 25,
    hasSchemaChanges: true,
    hasAIConsumerChanges: true,
    hasSecurityImplications: false,
    affectedDomains: ['delivery', 'platform'],
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
    primaryDomain: 'delivery',
    affectedDomains: input.affectedDomains as BusinessDomain[],
    technicalDomains: ['backend', 'frontend', 'ai'],
  }, result)
  console.log(`✓ Manifest created: ${manifest.id} (${manifest.status})`)
}
