import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Canales: boton reconectar, anti-estado-zombie connecting y Quiet Chrome en ConnectionsManager',
    description:
      'Corregir el fallo critico en la gestion de canales (WhatsApp/Baileys) donde un estado desconectado deja al usuario atrapado en la etiqueta connecting sin opcion de reintento. (1) Boton "Reconectar" explicito en tarjetas de canal WhatsApp con status !== connected que dispara el endpoint existente POST /api/channels/baileys/session (startBridgeSession). (2) Anti-zombie: AbortController 20s en fetch, timeout 60s en WebSocket, ws.onclose que resuelve a error si no estaba connected, boton "Cancelar" durante connecting. (3) Quiet Chrome: glass atmosferico (color-mix 90% + blur 24px), hairline --atmosphere-border, glow modulo, dot con --module-accent, errores con --mia-red. Un solo archivo (ConnectionsManager.tsx), sin props inventadas, sin endpoints ni librerias externas nuevas, sin cambios de schema, AI ni seguridad.',
    categories: ['ui_change', 'bugfix'],
    filesAffected: 1,
    hasSchemaChanges: false,
    hasAIConsumerChanges: false,
    hasSecurityImplications: false,
    affectedDomains: ['frontend'],
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
