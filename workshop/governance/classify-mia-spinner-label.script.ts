import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Texto "Cargando… un momento" + color por modulo en loading del dashboard',
    description:
      'Refinamiento visual del loading del dashboard: (1) MiaSpinner (src/components/ui/mia-spinner.tsx) acepta prop opcional label que renderiza el texto debajo del logo girando, con color var(--atmosphere-text-secondary); (2) src/app/dashboard/loading.tsx pasa a client component que en mount lee window.location.pathname (se actualiza al instante durante navegacion client-side, a diferencia de usePathname de AppLayout que va atrasado) y detecta el modulo con la misma logica de AppLayout (delivery->logistics, inventory->inventory, resto->sales), envolviendo el contenido en un div con data-module para que el logo y el texto usen la paleta correcta (ventas azul, inventario verde, delivery rojo) incluso en navegacion cruzada entre modulos. Texto del label: "Cargando… un momento". Las paginas auth conservan su texto "Verificando sesion...". Sin cambios de schema, API, backend ni AI. Verificacion: lint + build + unit (674) + Playwright (52) + visual en produccion navegando entre Ventas/Inventario/Delivery.',
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
