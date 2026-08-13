import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title:
      'Bridge WhatsApp: llamadas (rechazo defensivo) y notas de voz (respuesta del cerebro MIA)',
    description:
      'Bloque de defensa del bridge (visto en Modo 2 y aprobado por el concilio). (1) Evento "call" de Baileys: filtro status==="offer" y !isGroup, rejectCall(callId, from) de protocolo inmediato + texto defensivo con debounce en memoria (Map<jid, timestamp>, ventana configurable, poda perezosa; rechazar cada oferta pero texto 1x/ventana/llamante). Timers de reply en Set, limpiados en disconnect/restart; reply re-chequea status==="connected" y socket.user?.id; todo en try/catch sin re-throw. (2) audioMessage: en lugar de reenviar el literal "[Audio recibido]", mapear a payload estructurado { type: "audio" } para que MIA (la IA) redacte la respuesta con su estilo; fallback local del bridge (texto configurable) solo si MIA no responde o cae, para nunca dejar mudo al bot. Textos de cara al cliente en config.ts, redaccion aprobada por Product Manager. Archivos: services/whatsapp-bridge/src/session-manager.ts, config.ts, guards.ts (nuevo), y manejo del payload de audio en el webhook MIA (/api/channels/baileys/webhook).',
    categories: ['feature', 'ai_behaviour', 'api_change'],
    filesAffected: 4,
    hasSchemaChanges: false,
    hasAIConsumerChanges: true,
    hasSecurityImplications: true,
    affectedDomains: ['backend', 'ai', 'infrastructure'],
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
  console.log(`V Manifest created: ${manifest.id} (${manifest.status})`)
}
