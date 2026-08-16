import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Efecto Scale & Elastic Pop en modales y ventanas flotantes de edición',
    description:
      'Indicar visualmente cuando MIA guarda conocimiento o confirma una accion: (1) animacion global elasticPop en globals.css (keyframes elastic-pop, clase .animate-elastic-pop con cubic-bezier(0.34, 1.56, 0.64, 1), 0.35s, escala 0.85 -> 1.03 -> 1, con respeto a prefers-reduced-motion; el sistema ya define --ease-bounce con esa curva). (2) Entrada elastica en TODOS los modales cambiando el primitivo base: en src/components/ui/alert-dialog.tsx, AlertDialogContent reemplaza data-open:animate-in fade-in-0 zoom-in-95 por data-open:animate-elastic-pop (Base UI agrega data-open; afecta automaticamente a KnowledgeItemDialog, MediaEditDialog, RulesManager, InstructionsManager, ConnectionsManager, MediaBrowser, CatalogGrid, ProductFormDialog, ProductDetail, ImportDialog y TeachModal). Entrada elastica tambien en los modales overlay custom (DeliveryDriversPanel magic-link modal, LaboratorioClient teach modal) y en el panel flotante MIAInbox. (3) Confirmacion de guardado reutilizable: nuevo componente src/components/ui/success-pop.tsx (SuccessPop: tarjeta centrada con check que reproduce .animate-elastic-pop al montarse) integrado en los flujos de save: KnowledgeItemDialog (+ prop success) con KnowledgeManager, MediaEditDialog (auto-cierre tras ~900ms), InstructionsManager, RulesManager, ProductFormDialog, ImportDialog y TeachModal (feedback card). Sin cambios de schema, sin cambios de backend, sin cambios de AI behavior. Verificacion: lint, build, unit tests (test del componente SuccessPop), e2e existentes, DevTools (consola limpia al abrir/guardar en modales), revision de rendimiento (animacion GPU-only, transform/opacity, sin layout) y seguridad (sin cambios en datos/acceso).',
    categories: ['feature', 'ui_change'],
    filesAffected: 15,
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
