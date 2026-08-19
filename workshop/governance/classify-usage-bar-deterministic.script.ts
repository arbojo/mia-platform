import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'
import { AGENT_LABELS } from './types'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const input: OrchestratorInput = {
  title:
    "UsageBar deterministico: locale explicito es-MX en el formato numerico (test + componente)",
  description:
    "Hallazgo pre-existente de subaru-audit-v2 (gate unit_tests BLOCKED, fuera de scope): src/components/laboratorio/UsageBar.tsx usa toLocaleString() sin locale, por lo que el formato de miles depende del locale ICU del runtime de la maquina. En este entorno renderiza 12.000 (formato es) pero tests/component/usage-bar.test.tsx espera 12,000 (en-US). Fix: aplicar locale explicito 'es-MX' en UsageBar.tsx siguiendo la convencion ya existente en AIOperationsCard y TodaysActivity (toLocaleString('es-MX')), y ajustar el test para esperar 12.000 / 3.400. NO forzar un PASS artificial modificando solo el test: el componente tambien es no determinista entre entornos. Alcance: 2 archivos (componente + test), un solo dominio, sin schema.",
  categories: ['bugfix'],
  filesAffected: 2,
  hasSchemaChanges: false,
  hasAIConsumerChanges: false,
  hasSecurityImplications: false,
  affectedDomains: ['frontend'],
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
