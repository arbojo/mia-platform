import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Pulir UI/UX de la tarjeta de WhatsApp y filas de conexiones (textos amigables y estilos estandarizados)',
    description:
      'Cambios de UI/UX en ConnectionsManager sin tocar logica ni API: (1) traducir estados tecnicos a mensajes humanos (active->Activo, connecting->Conectando..., connected->Conectado) en badges, estado de fila y modos; (2) estandarizar el estilo visual de los botones principales (misma variante primary) entre el card de WhatsApp y las filas de conexion; (3) ocultar complejidad: si el nombre del asistente es un UUID o esta vacio, mostrar un nombre amigable (Asistente Principal / Asistente N) manteniendo el UUID como valor interno; (4) hacer mas prominente el estado Desconectado con un tono de advertencia sutil (naranja) en el texto y el indicador. Afecta 2 archivos (componente + test de componente). Sin cambios de schema ni AI, sin implicaciones de seguridad.',
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
