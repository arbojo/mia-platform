import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Delivery Hub: PWA offline-first del Portal del Repartidor',
    description:
      'Implementar PWA offline-first del Portal del Repartidor /driver. (A) Service Worker hand-rolled en public/sw.js (sin deps): precache del app shell (/driver, /driver/login, manifest, iconos) con network-first para HTML preservando el magic-link (nunca cachear redirects de login), stale-while-revalidate para /_next/static/*, y network-first con fallback a cache para GET /api/driver/*; cache versionada + limpieza; nunca cachear respuestas no-2xx o con Set-Cookie. (B) Outbox IndexedDB completo que arregla el bug de solo-escritura: flush automático via POST /api/driver/sync (lotes <=50, dedupe por idempotency_key) en evento online + arranque + tras cada enqueue; detección de error extendida a AbortError (timeout 8s via AbortSignal) y DriverApiError 5xx como retryable; entrega diferida completa reutilizando POST /api/driver/deliveries/{visitId}/delivered con foto como Blob en IndexedDB (GPS capturado offline es hardware satelital) + GPS samples + kinship/amount/payment; incidencias (IncidentForm) pasan a encolar incidencia_reportada. (C) Lectura offline: cache IndexedDB del listado y detalle de entregas escrito en cada GET exitoso para render de respaldo con banner cuando falle la red. Sin cambios de schema (la evidencia usa el bucket PRIVATE delivery-evidence existente via applyDelivered).',
    categories: ['feature', 'ui_change', 'api_change', 'security'],
    filesAffected: 11,
    hasSchemaChanges: false,
    hasAIConsumerChanges: false,
    hasSecurityImplications: true,
    affectedDomains: ['frontend', 'backend', 'infrastructure'],
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
