import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title:
      'Edicion por negocio (tenant): capabilities premier para Vitanova con resolucion por businessId y fallback al env global',
    description:
      'Resolver el desalineamiento donde MIA_EDITION=evaluation global en Vercel oculta WhatsApp (tarjeta QR de ConnectionsManager) incluso para el tenant premier Vitanova, mientras el bridge opera una sesion real conectada. Diseno: las atribuciones son por NEGOCIO (tenant), no por persona: un email nuevo recibe su propio business auto-provisionado (migracion 018) con edicion vacia -> cae al env global (evaluation) y queda gateado. (1) Migracion 037: ALTER TABLE businesses ADD COLUMN edition text NULL CHECK IN (evaluation, professional, enterprise, cloud); NULL = usar env global. (2) edition.ts: resolver edicion efectiva por negocio (getEffectiveEdition(businessId), server-only, DB primero con fallback a getEdition()). (3) connections/page.tsx (y delivery/inventory para consistencia de interfaz completa del tenant premier) resuelven por negocio. (4) Enforcement server-side en rutas baileys (session, reconnect, ws-token): validar capacidad whatsapp por businessId. (5) Backfill Vitanova (4fb7418d-6c98-4a09-9094-4e4e4b2006a6) edition=professional. (6) Fix de desfase: sincronizar channel_connections.status al recibir evento connected del bridge (anti-zombie connecting).',
    categories: ['schema_change', 'feature', 'api_change', 'security', 'bugfix'],
    filesAffected: 8,
    hasSchemaChanges: true,
    hasAIConsumerChanges: false,
    hasSecurityImplications: true,
    affectedDomains: ['database', 'backend', 'frontend'],
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
