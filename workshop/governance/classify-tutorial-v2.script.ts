import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Ajustes al tutorial interactivo: shell solo en Centro de Mando, boton Tutorial junto a Accesibilidad y tour de Knowledge Studio',
    description:
      'Refinamiento de UX del tour interactivo del dashboard. (1) El shell (6 pasos: navegacion, modulo, tema, idioma, campana, MIA) solo se ensena en /dashboard; las demas paginas contextuales (conversations, knowledge, catalog, knowledge-studio) muestran solo sus pasos de pagina; en paginas sin tour contextual el boton Tutorial sigue reproduciendo el shell. (2) El boton Tutorial se mueve del footer del sidebar a la lista de navegacion, como ultimo item del grupo Configuracion justo debajo de Accesibilidad, para que no quede separado de los temas. (3) Nuevo tour para /dashboard/knowledge-studio (Pensamiento): 4 pasos (studio-analyze el boton Ejecutar Analisis siempre visible; studio-score la puntuacion; studio-stats la fila de 3 tarjetas; studio-suggestions el bloque de sugerencias y filtros), con anclas data-tour anadidas en KnowledgeStudio y seccion tour.studio en los 4 diccionarios i18n. Sin cambios de schema ni de AI ni de seguridad.',
    categories: ['feature'],
    filesAffected: 9,
    hasSchemaChanges: false,
    hasAIConsumerChanges: false,
    hasSecurityImplications: false,
    affectedDomains: ['frontend', 'i18n', 'ux'],
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
