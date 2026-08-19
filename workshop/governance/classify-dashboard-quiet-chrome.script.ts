import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Dashboard Quiet Chrome: migrar tarjetas legacy a glass atmosferico + ghost UI context menu',
    description:
      'Migrar el Dashboard principal (page.tsx + VitalPresence, SalesMetricsCard, WeeklyReportCard, ConversationTimeline) al sistema de diseno Quiet Chrome: reemplazar --elevation-1/--shadow-card/rounded-2xl por glass real (color-mix con --atmosphere-bg 90%, backdrop-filter blur 24px saturate 1.4), hairline --atmosphere-border, glow 0 0 0 1px var(--module-accent-border) + 0 0 32px var(--module-glow-soft), radios --mod-radius-lg. Integrar useContextMenu (context-menu.tsx existente) en las tarjetas interactivas y delegar el boton estatico Generar del WeeklyReportCard al menu contextual. Reutiliza exclusivamente infraestructura existente; sin props inventadas; sin cambios de schema, AI ni seguridad.',
    categories: ['ui_change', 'feature'],
    filesAffected: 5,
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
