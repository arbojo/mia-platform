import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title:
      'Directiva del Concilio: reformular Rol, Reglas Fundamentales (4 reglas del inquilino) y Formato de Respuesta en el system prompt de MIA',
    description:
      'El usuario (concilio convocado) entrega una nueva directiva para el system prompt de MIA: ROL ("Eres MIA, un asistente comercial experto y persuasivo... reconducir siempre la conversación hacia la venta o la recomendacion"), 4 REGLAS FUNDAMENTALES INMUTABLES y FORMATO DE RESPUESTA. DISEÑO de implementacion: (1) Reglas Fundamentales: reemplazar el bloque numerado actual (prompts.ts:253-258) por las 4 reglas de la directiva como reglas 1-4 (nuevos textos en las 4 diccionarios i18n): R1 neverInvent "NUNCA inventes informacion, precios, caracteristicas ni productos que no esten explicitamente registrados en tu contexto de conocimiento o catalogo"; R2 offTopicBridge nueva "temas ajenos al negocio: no des informacion externa, usalos como puente hacia los productos o soluciones del negocio"; R3 ifUnsure "si no sabes algo especifico del negocio o un dato exacto no esta disponible en tus fuentes, responde honestamente con la directriz asignada (ej. \"Dejame revisar eso con el equipo\") y mantén firme tu rol comercial"; R4 knowledgeBoundary nueva "tu conocimiento comercial esta delimitado unica y exclusivamente por el catalogo, las reglas de venta y la documentacion provista por este inquilino". Las reglas operativas vigentes SE PRESERVAN como reglas 5-7: askCity (preguntar ciudad/promesas de entrega), noDiscounts (no mencionar descuentos) y humanHandoff (handoff humano), reforzadas en el concilio previo TASK-20260813-232356688 y no revocadas por esta directiva. (2) ROL: ampliar la linea de apertura (prompts.ts:242) con el proposito de la directiva (nueva clave salesPurpose): guiar al cliente, resolver dudas basandose estrictamente en el inventario y las reglas provistas, y reconducir hacia la venta o recomendacion. (3) FORMATO DE RESPUESTA: nueva seccion en prompts.ts despues de Reglas Fundamentales con 2 claves nuevas (responseFormat + texto de tono cercano/profesional/enfocado en el beneficio, y recomendacion con nombre, valor y como resuelve la necesidad usando datos del catalogo). (4) Actualizar tests/i18n/prompts-i18n.test.ts (nuevas claves y numeracion 1-7). Archivos: src/lib/i18n/dictionaries/{es,en,pt,ja}.ts, src/lib/ai/prompts.ts, tests/i18n/prompts-i18n.test.ts. SIN migraciones SQL. SIN llamadas extra de OpenAI. El nombre del asistente se mantiene parametrizado (assistant.name) para no romper negocios con nombres custom.',
    categories: ['ai_behaviour'],
    filesAffected: 6,
    hasSchemaChanges: false,
    hasAIConsumerChanges: true,
    hasSecurityImplications: false,
    affectedDomains: ['ai', 'backend'],
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
