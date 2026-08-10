import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Fix hydration mismatch en AppLayout por lectura de localStorage en estado inicial',
    description:
      'AppLayout.tsx lee localStorage.getItem("mia-module") dentro del initializer de useState. En el server ese codigo devuelve null (typeof window === undefined), pero en el primer render del cliente devuelve el modulo almacenado (ej. logistics), causando hydration mismatch (React #418) porque el server renderizo detectModule() -> sales. Fix estandar SSR-safe: mover la lectura de localStorage a un useEffect que corre despues del mount (setManual), dejando el estado inicial en null para que server y cliente rendericen identico. Sin cambios de schema, sin cambios de comportamiento de AI, sin implicaciones de seguridad.',
    categories: ['bugfix'],
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
    domains: input.affectedDomains,
  }, result)
  console.log(`✓ Manifest created: ${manifest.id} (${manifest.status})`)
}
