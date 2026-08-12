import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title:
      'Delivery Hub paywall por tenant: enmarcar capacidades delivery/inventory en la edition del negocio (ADR-019)',
    description:
      'Proteger el trabajo ya desarrollado del paywall del Delivery Hub (ADR-019) que quedo sin commitear en el working tree tras la mision whatsapp-edition-sync. Los cambios: (1) src/components/delivery/DeliveryPaywall.tsx (nuevo) - pantalla de upgrade con la marca Delivery Hub para negocios sin edition enterprise/cloud; (2) src/app/dashboard/delivery/page.tsx - gate del modulo logistico con canBusinessUseDeliveryHub(business.id) en vez del env global, renderizando <DeliveryPaywall/> cuando el negocio no tiene la capacidad; (3) src/app/dashboard/inventory/page.tsx - migrar el gate de canUseInventoryHub() (env global) a canBusinessUseInventoryHub(business.id), coherente con la edition por tenant ya desplegada. Depende de getEffectiveEdition/canBusinessUseDeliveryHub/canBusinessUseInventoryHub ya commiteados (b8c4756). Sin cambios de schema, sin cambios de AI, sin nuevos endpoints.',
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
    domains: input.affectedDomains,
  }, result)
  console.log(`✓ Manifest created: ${manifest.id} (${manifest.status})`)
}
