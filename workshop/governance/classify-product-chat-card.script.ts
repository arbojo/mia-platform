import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title:
      'Tarjetas de producto enriquecidas en el chat web: adjuntar el producto recomendado por MIA al mensaje del asistente',
    description:
      'Cuando MIA recomienda un articulo en el chat web (widget, dashboard, training), la burbuja del asistente debe incluir una tarjeta de producto con imagen principal, precio y beneficios. DISENO aprobado en Modo 2: (1) Resolucion DETERMINISTA del producto recomendado, sin llamadas extra de OpenAI ni cambios de prompt, reutilizando senales existentes: landingContext.productId si viene de una landing/producto (ya resuelto en loadConversationContext); si no, matcheo por intent/trigger sobre knowledge_items con product_id (reusa triggerMatches/intentMatchesTrigger de conditional-media.ts); fallback a keywords de intents.ts. Devuelve null si ambiguo (burbuja solo texto). (2) Contrato: nuevo tipo compartido ProductReference { productId, name, price, imageUrl, description, benefits } en src/lib/channels/types.ts (compartido web + whatsapp). Persistencia en messages.metadata.product_id (columna JSONB ya existente, SIN migracion). (3) Transporte: /api/chat pasa de toTextStreamResponse() a toDataStreamResponse() (protocolo AI SDK con partes text-delta + data). Los dos consumidores (ChatWindow.tsx y LabChatWindow.tsx) se actualizan para tolerar el nuevo protocolo; LabChatWindow ignora las data parts. (4) UI: nuevo componente src/components/chat/ProductMessageCard.tsx (<150 lineas, shadcn/ui, use client) que renderiza bajo la burbuja de texto, alineado a la izquierda (estilo WhatsApp): imagen aspect-video object-cover con fallback Package, nombre, precio text-olive-600, beneficios con checks y line-clamp-2; accesible con alt={name}. (5) Historial: GET /api/conversations/[id]/messages amplia el select para incluir metadata y restaurar la tarjeta al recargar. SIN cambios de schema (messages.metadata ya existe) y SIN cambios de prompt/comportamiento de IA (el texto recomendado ya se genera; solo se adjunta el dato estructurado).',
    categories: ['feature', 'api_change', 'ui_change'],
    filesAffected: 7,
    hasSchemaChanges: false,
    hasAIConsumerChanges: false,
    hasSecurityImplications: false,
    affectedDomains: ['backend', 'frontend', 'ai'],
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
