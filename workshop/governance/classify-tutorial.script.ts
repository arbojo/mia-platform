import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Tutorial interactivo contextual del dashboard (spotlight tour, activable desde sidebar)',
    description:
      'Feature de UX: tour interactivo que muestra que hace cada boton de la pagina actual, activable desde el sidebar y con auto-ofrecimiento en la primera visita (persistido en localStorage). Componente propio sin dependencias nuevas, reutilizando el patron de portal del context-menu existente. Arquitectura: (1) src/components/tour/types.ts (TourStep con target selector + claves i18n), (2) src/components/tour/TourProvider.tsx (context global, estado activo, resolucion de tour por pathname, auto-ofrecimiento, start/next/prev/close), (3) src/components/tour/TourOverlay.tsx (portal a document.body, spotlight via box-shadow 9999px sobre el target, tooltip glass, progreso x/N, botones Saltar/Anterior/Siguiente, scrollIntoView por paso, teclado Escape/Flechas, clamp al viewport, role=dialog), (4) src/lib/tour/tours.ts (registro de tours: shell + 4 paginas prioritarias Home, Conversations, Knowledge, Catalog), (5) integracion en src/app/dashboard/layout.tsx (montar TourProvider) y boton Tutorial al pie de src/components/dashboard/ActivityRail.tsx, (6) seccion tour en diccionarios i18n es/en/pt/ja, (7) anclas data-tour minimas donde faltan (tabs de KnowledgeCenter, botones header de CatalogGrid), (8) tests de componente. Sin cambios de schema ni de AI ni de seguridad.',
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
    domains: input.affectedDomains,
  }, result)
  console.log(`✓ Manifest created: ${manifest.id} (${manifest.status})`)
}
