import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Hacer visible el logo MIA girando (duracion minima en auth + loading dashboard)',
    description:
      'El usuario reporto que no vio el logo girando porque los spinners duran milisegundos. Refinamiento del MiaSpinner (TASK-20260816-042844183): (1) login/page.tsx y signup/page.tsx: el bloque "Verificando sesion..." con MiaSpinner ahora tiene una duracion minima de 600ms (startedAt + remain = max(0, 600-elapsed)) para que el logo gire siempre al cargar la app, tanto en redirect como en setCheckingAuth(false); (2) nuevo src/app/dashboard/loading.tsx: MiaSpinner centrado (min-h, full width) que se muestra durante la navegacion entre modulos del dashboard. Sin cambios de schema, API, backend ni AI. Verificacion: lint + build + unit (674) + Playwright (52) + visual en produccion.',
    categories: ['ui_change'],
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
