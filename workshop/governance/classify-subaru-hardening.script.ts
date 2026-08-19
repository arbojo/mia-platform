import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'
import { AGENT_LABELS } from './types'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const input: OrchestratorInput = {
  title:
    'Endurecer protocolo Return-by-Death (Subaru): governance validado, mark secuencial, complete verificado, revive con drift detection',
  description:
    'Mision de endurecimiento del protocolo Return-by-Death (Subaru), NO reescritura. A partir de la auditoria de workshop/subaru/*: (1) freeze debe validar governance via WorkflowEngine.assertGovernance (rechaza manifest inexistente o no aprobado) y scaffoldear el blueprint ejecutable con las secciones estructurales (Mission, Scope, Non-goals, Approved plan atomico con pasos `- [ ] **Paso N:**`, Current state, Next action, Constraints, Verification, Recovery instructions); (2) mark secuencial: solo permite marcar currentStep+1 y falla duro si el checkbox `Paso N:` no existe en el body (evita divergencia frontmatter/body); (3) complete verificado: exige todos los checkboxes [x], currentStep==totalSteps y manifest governance aprobado, impidiendo complete prematuro; (4) revive completo: valida legibilidad del checkpoint, inspecciona el repo (git status), detecta drift (working tree sucio, commits locales sin pushear, cambios posteriores al ultimo checkpoint subaru), produce reporte operativo (Completed, Next, Next action, Files expected, Constraints, Required verification, DO NOT, Recovery status), emite DRIFT DETECTED y BLOCKED - HUMAN/COUNCIL INPUT REQUIRED ante contradiccion, y falla de forma segura ante checkpoint corrupto o ilegible explicando que falta; (5) bootstrap con checks de git, checkpoint y resync del espejo global del agente; (6) reconciliar total_steps con los checkboxes reales del body (el checkpoint actual de quiet-chrome muestra total_steps 5 con 8 pasos en el body); (7) estado `frozen` en vez de `blueprint_ready` (commit sigue siendo - listo); (8) archivar checkpoint completado en docs/checkpoints/archive/ al congelar una mision nueva. Tests de integracion en workshop/subaru/cli.test.ts sobre repo git temporal (happy path freeze-mark-mark-complete, death simulation freeze-mark-muerte-revive-continuar, multi-maquina repo A push -> repo B pull revive, invalid transitions mark antes de freeze/saltar pasos/complete incompleto/freeze sobre mision activa sin --force, push failure distinguiendo LOCAL CHECKPOINT vs REMOTE CHECKPOINT, drift detection, checkpoint corrupto/missing fail seguro). Sin cambios de schema, sin cambios de AI, sin implicaciones de seguridad de datos (el checkpoint no almacena secretos).',
  categories: ['bugfix', 'refactor', 'infrastructure'],
  filesAffected: 8,
  hasSchemaChanges: false,
  hasAIConsumerChanges: false,
  hasSecurityImplications: false,
  affectedDomains: ['infrastructure', 'engineering-process'],
}

const result = orchestrator.classify(input)
console.log(orchestrator.generatePreFlightSummary(result))
console.log()

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

console.log(`✓ Manifest created: ${manifest.id}`)
console.log(`  Status: ${manifest.status}`)
console.log(`  File: .governance/tasks/${manifest.id}.json`)
console.log()
console.log('  Required agents:')
for (const agent of result.requiredAgents) {
  console.log(`    → ${AGENT_LABELS[agent] ?? agent}`)
}
console.log()
console.log('  Quality gates:')
for (const gate of result.qualityGates) {
  console.log(`    → ${gate}`)
}
