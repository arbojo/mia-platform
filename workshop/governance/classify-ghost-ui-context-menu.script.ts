import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Ghost UI context menu en MIAInbox (reutilizando context-menu.tsx)',
    description:
      'Integrar el sistema de menu contextual de clic derecho existente (src/components/ui/context-menu.tsx, useContextMenu + ContextMenuProvider) en las tarjetas de senales de MIAInbox: cada senal gana onContextMenu con acciones contextuales (Marcar como resuelta via PATCH /api/signals/[id], Abrir conversacion si action_available === open_conversation), eliminando el boton flotante redundante de Check por senal. Se reutiliza la infraestructura existente (preventDefault+stopPropagation, listeners globales pointerdown/scroll/keydown con cleanup, portal, clamp de viewport, teclado, estetica Quiet Chrome con tokens) sin duplicar hook ni componente. Sin cambios de schema, sin cambios de comportamiento de AI, sin implicaciones de seguridad.',
    categories: ['ui_change', 'feature'],
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
    domains: input.affectedDomains,
  }, result)
  console.log(`✓ Manifest created: ${manifest.id} (${manifest.status})`)
}
