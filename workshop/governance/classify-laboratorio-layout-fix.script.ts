import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Fix layout del Laboratorio: tarjeta Escenarios cortada y encogida',
    description:
      'En dashboard/laboratorio la tarjeta "Escenarios de prueba" de la columna izquierda no se muestra completa y se encoge cada vez que aparece una tarjeta de sesion de chat de prueba. Causa raiz: la columna izquierda (LaboratorioClient.tsx:183) es flex sin min-h-0 ni overflow-y-auto, sus hijos flex se comprimen (flex-shrink: 1) cuando el contenido excede la altura disponible y el Card de escenarios tiene overflow-hidden (src/components/ui/card.tsx:15), recortando los escenarios inferiores; ademas la altura raiz h-[calc(100vh-4rem)] no descuenta el CommandStrip (~3rem) ni el padding p-8 (4rem) del dashboard, dejando el layout ~48px mas alto que el viewport. Fix: (1) columna izquierda -> min-h-0 + overflow-y-auto, (2) shrink-0 en los tres bloques (SimulationModes, ScenariosPanel, SessionHistory), (3) h-[calc(100vh-4rem)] -> h-[calc(100dvh-7rem)]. Sin cambios de schema, ni de comportamiento de IA, ni implicaciones de seguridad.',
    categories: ['bugfix', 'ui_change'],
    filesAffected: 3,
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
