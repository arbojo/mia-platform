import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Sidebar estable: Configuracion en la nav principal y sin colapso por hover',
    description:
      'Redisenar la sidebar ActivityRail: (1) mover la opcion Configuracion (hoy un boton al pie que abre dropdown flotante con Conexiones, Concilio, Salud y Accesibilidad) a la lista principal de navegacion como grupo con enlaces estaticos normales, siempre visibles; (2) hacer el sidebar completamente estable eliminando el colapso/expansion por hover-intent (zonas muertas y precision quirurgica del mouse) y dejando un ancho fijo siempre expandido; (3) quitar el estado settingsHovered y el uso de useHoverIntent en el rail (el hook queda intacto para MIAIndicator). Solo 2 archivos (ActivityRail.tsx y un test de componente nuevo), sin props inventadas, sin dependencias externas, sin cambios de schema, AI ni seguridad.',
    categories: ['ui_change'],
    filesAffected: 2,
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
