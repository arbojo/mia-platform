import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Conectar boton WhatsApp (Conectar/Reconectar/Estado) con el bridge de produccion',
    description:
      'Arreglar y conectar el control de WhatsApp en ConnectionsManager: (1) agregar al bridge un endpoint POST /v1/sessions/:businessId/reconnect que cierra el socket sin borrar credenciales y reconecta (nuevo QR si hace falta), ya que hoy /start es no-op si la sesion existe y deja al usuario atrapado; (2) exponer reconnectBridgeSession en lib/baileys/bridge.ts y una ruta nueva POST /api/channels/baileys/reconnect con ownership check, usando WHATSAPP_BRIDGE_URL y WHATSAPP_BRIDGE_SECRET (secreto via header x-mia-bridge-secret) apuntando a https://mia-whatsapp-bridge.fly.dev en produccion; (3) en el frontend: consultar GET /api/channels/baileys/session al montar y con un boton Estado/refresh, boton Reconectar que fuerza reconnect + reabre WebSocket de QR/status, y feedback visual claro (Desconectado / Conectando / Generando QR / Conectado con telefono / Error) con spinner y badges, sin comportamientos mudos. Incluye tests de componente y redeploy del bridge en Fly.io (workshop/deploy/bridge-fly.ps1) y de la app en Vercel. 6 archivos, sin cambios de schema ni AI, sin nuevas credenciales.',
    categories: ['api_change', 'ui_change', 'infrastructure'],
    filesAffected: 6,
    hasSchemaChanges: false,
    hasAIConsumerChanges: false,
    hasSecurityImplications: false,
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
