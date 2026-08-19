import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Delivery Hub: modulo logístico aislado (schema delivery) + Portal del Repartidor',
    description:
      'Implementar el MIA Delivery Hub bajo el marco híbrido aprobado por el Concilio (Opción 3: aislamiento absoluto en monorepo). (1) Migración 031_delivery_hub.sql: schema PostgreSQL `delivery` completo (business_settings, drivers, orders, routes, visits, driver_events, daily_closures, driver_sessions, outbox_events, evidence_photos, order_counters, ingest_errors, audit_log) con ENABLE/FORCE RLS + REVOKE ALL FROM anon/authenticated/PUBLIC + policies admin (business owner), y trigger AFTER INSERT ON public.sales_events (event_type=SALE_WON) SECURITY DEFINER search_path=\'\' que replica a delivery.orders con ingest_errors (1-way, idempotente vía UNIQUE sales_event_id). (2) Ley de Cierre Diario POR REPARTIDOR: candado en dos capas — trigger BEFORE INSERT ON delivery.routes (RAISE si el driver tiene ruta previa no closed) + check API 409 CLOSURE_PENDING; daily_closures liquida totales. (3) Autenticación driver: token 32B base64url + scrypt hash, magic link de un solo uso, cookie HttpOnly+Secure+SameSite=Lax firmada con DRIVER_SESSION_SECRET (JWT HMAC, 15-30 min, renovación deslizante), /driver/* excluido de src/proxy.ts. (4) API routes admin (/api/admin/delivery/*, auth requirePageAuth) y driver (/api/driver/*, auth requireDriverAuth Bearer + assertDriverOrderAccess). (5) Portal PWA /driver con layout propio: dashboard incentivos (ganancia del día vs meta, % efectividad, histórico semanal), botones Voy en camino / Ya estoy aquí que disparan WhatsApp al cliente (Graph Cloud API con idempotencia via outbox_events + fallback wa.me, fuera Baileys), validación GPS de proximidad server-side (doble muestreo, umbral, calibración manual auditada en audit_log), tipificación de incidencias (→ Revisitar via revisit_of), evidencia de entrega (parentesco + foto obligatoria en bucket PRIVATE delivery-evidence con signed URLs y magic bytes), soporte offline (outbox IndexedDB + POST /api/driver/sync con dedupe por idempotency_key). (6) Licenciamiento por negocio: capability deliveryHub en edition.ts (enterprise/cloud) + flag delivery.business_settings.enabled con gate server-side. (7) Tests: tests/delivery/*.test.ts (incentives, daily-close, outbox, gps, token, whatsapp-trigger, evidence, replication) + e2e admin-delivery.spec.ts y driver.spec.ts con fixtures.',
    categories: ['feature', 'schema_change', 'api_change', 'security'],
    filesAffected: 35,
    hasSchemaChanges: true,
    hasAIConsumerChanges: false,
    hasSecurityImplications: true,
    affectedDomains: ['frontend', 'backend', 'database', 'infrastructure'],
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
