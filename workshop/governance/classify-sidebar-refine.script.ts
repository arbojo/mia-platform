import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Sidebar refine: posicion Settings, hover intent con grace period, purga verde legacy + Quiet Chrome',
    description:
      'Refinar la sidebar ActivityRail: (1) reposicionar el boton Configuracion con aire simetrico y estado hover; (2) corregir la hiper-reactividad del collapse anadiendo leaveDelayMs al hook useHoverIntent (retrocompatible, MIAIndicator sin cambios) y usandolo en el rail; (3) purgar el tinte verde legacy del logo MIA (var(--atmosphere-accent) -> var(--module-accent)) y aplicar glass real de Quiet Chrome (color-mix 90% + backdrop-filter blur 24px saturate 1.4). Solo 2 archivos (ActivityRail.tsx, use-hover-intent.ts), sin props inventadas, sin dependencias externas, sin cambios de schema, AI ni seguridad.',
    categories: ['ui_change', 'bugfix'],
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
