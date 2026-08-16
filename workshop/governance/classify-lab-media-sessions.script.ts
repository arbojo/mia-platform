import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Laboratorio: historial de sesiones gestionable + imágenes condicionales en el simulador',
    description:
      'Dos mejoras pedidas por el usuario en el laboratorio (dashboard/laboratorio). (1) Historial de sesiones del sidebar (SessionHistory): las tarjetas de sesiones anteriores persisten para siempre y sin forma de borrarlas; se agrega DELETE /api/laboratorio/sessions/[id] (borrar una) y DELETE /api/laboratorio/sessions?businessId= (limpiar todo, con validacion de propiedad del owner), filtro por assistantId en GET y en la UI, boton eliminar por tarjeta + boton Limpiar historial. (2) Imagenes condicionales en el simulador: hoy /api/chat -> processStreaming nunca resuelve resolveConditionalMedia y no pasa channel al prompt, por lo que el lab no muestra imagenes ni anuncia IMAGEN_DISPONIBLE. Se agrega channel simulation al union de loadConversationContext/buildMasterPrompt/formatKnowledge (para que la nota [IMAGEN_DISPONIBLE] con trigger y descripcion semantica llegue al prompt del lab), processStreaming acepta channel y llama resolveConditionalMedia por mensaje, stream-response emite evento SSE media (imageUrl/mediaType) y sse.ts lo parsea, LabChatWindow/ChatWindow renderizan adjunto de imagen en la burbuja del asistente, y media.ts agrega isResendRequest() para que resolveConditionalMedia salte los guards chat_media_dispatched/media_sent_products cuando el cliente pide explicitamente que se reenvie la imagen (solo una vez por conversacion salvo re-pedido). Sin cambios de schema. Verificacion: lint, build, unit tests (nuevos tests de isResendRequest y del evento media), e2e, DevTools, revision de rendimiento (un fetch extra por mensaje solo cuando hay conversationId) y seguridad (URLs pasan isSafeMediaUrl; DELETE valida owner).',
    categories: ['feature', 'ai_behaviour', 'api_change', 'ui_change'],
    filesAffected: 11,
    hasSchemaChanges: false,
    hasAIConsumerChanges: true,
    hasSecurityImplications: false,
    affectedDomains: ['frontend', 'backend', 'ai'],
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
