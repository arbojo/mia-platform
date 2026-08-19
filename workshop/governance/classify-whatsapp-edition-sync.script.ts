import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title:
      'WhatsApp en produccion: edition por tenant (migracion 037 + deploy) y reconciliacion read-path del estado channel_connections',
    description:
      'Resolver dos problemas de produccion en el canal WhatsApp (Baileys). (1) GATE DE EDICION: la tarjeta WhatsApp no se renderiza en Vercel prod porque canUseWhatsApp() solo lee MIA_EDITION. Fix tenant-scoped ya preparado localmente: getEffectiveEdition() DB-first (businesses.edition con fallback a MIA_EDITION), canBusinessUseWhatsApp() como guard 403 en POST session, page.tsx de connections resuelve la edition del negocio del usuario, y la migracion 037 agrega columna edition a businesses con backfill de Vitanova -> enterprise. Aplicar migracion 037 en Supabase prod y desplegar los cambios. (2) SINCRONIZACION DE ESTADO: channel_connections.status queda atrapado en "connecting" (estado fantasma) porque solo POST session/reconnect lo escriben y jamas transiciona a connected; el bridge persiste su estado real solo en whatsapp_sessions. Fix read-path: en GET /api/channels/baileys/session, tras getBridgeSessionStatus, reconciliar channel_connections.status (admin client) cuando difiera, y en ConnectionsManager refrescar refreshConnections() tras un refreshWaStatus con estado resuelto para que la fila de la lista refleje el estado real del bridge. Sin cambios de AI, sin nuevos endpoints, sin puente redeploy.',
    categories: ['schema_change', 'bugfix', 'api_change', 'ui_change'],
    filesAffected: 7,
    hasSchemaChanges: true,
    hasAIConsumerChanges: false,
    hasSecurityImplications: false,
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
    primaryDomain: 'sales',
    affectedDomains: [],
    technicalDomains: input.affectedDomains,
  }, result)
  console.log(`✓ Manifest created: ${manifest.id} (${manifest.status})`)
}
