import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Opcion Desechar por sugerencia en Enseñarle a MIA (TeachModal)',
    description:
      'El TeachModal (src/components/laboratorio/TeachModal.tsx) abre una tarjeta por cada sugerencia de la evaluacion de sesion y bloquea el guardado si NO todas las tarjetas tipo conocimiento tienen pregunta: handleSave (lineas 60-64) valida el array completo y cancela todo con error. No existe forma de descartar una sugerencia individual; solo Cancelar (descarta todo) o Guardar (exige completar todas). Fix UI puro en 1 archivo: (1) boton Desechar (icono X, variant ghost size sm) en la esquina de cada tarjeta que elimina esa sugerencia de items via setItems(prev => prev.filter((_, i) => i !== index)); (2) estado vacio: si items.length === 0 tras desechar, mostrar "Descartaste todas las sugerencias" + boton Cerrar (onClose) en lugar del listado vacio. Validacion y guardado intactos: solo aplican a las tarjetas restantes. Sin cambios de schema, API, backend ni AI. Verificacion: lint + build + unit (674) + Playwright (52) + verificar en produccion (Vercel) el modal con varias sugerencias.',
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
    domains: input.affectedDomains,
  }, result)
  console.log(`✓ Manifest created: ${manifest.id} (${manifest.status})`)
}
