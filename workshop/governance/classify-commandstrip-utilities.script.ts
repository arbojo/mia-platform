import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Separar utilidades del chip de modulo en CommandStrip (tema, idioma, MIA Signals)',
    description:
      'El chip de la barra superior del dashboard muestra el modulo activo (p.ej. "Ventas") pero al hacer clic abre un menu contextual mezclado que combina toggle de tema, selector de idioma, switch de modulos y MIA Signals. Confunde al usuario: el chip con nombre de modulo abre utilidades sin relacion. Plan: (1) el chip de modulo solo abre el switch de modulos (Ventas/Inventario/Logistica), (2) el cambio de tema pasa a su propio boton (Sun/Moon, toggle directo), (3) el cambio de idioma pasa a su propio boton (icono Globe, abre menu contextual con los locales), (4) MIA Signals se mantiene solo en la campana (SignalIndicator + MIAInbox) que ya existe. Unico archivo: src/components/dashboard/CommandStrip.tsx. Sin cambios de schema ni de AI ni de seguridad.',
    categories: ['ui_change'],
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
    primaryDomain: 'sales',
    affectedDomains: [],
    technicalDomains: input.affectedDomains,
  }, result)
  console.log(`✓ Manifest created: ${manifest.id} (${manifest.status})`)
}
