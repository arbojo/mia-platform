import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'
import { AGENT_LABELS } from './types'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const input: OrchestratorInput = {
  title:
    'Auditoria y endurecimiento Subaru v2: fix multi-maquina, bootstrap, estado frozen, gates en complete, drift detallado + secret scan, docs',
  description:
    'A partir de la auditoria de workshop/subaru/* (checkpoint activo reemplazado): (1) fix del harness de tests multi-maquina en cli.test.ts: cloneRepo() debe configurar identidad git (user.email/user.name) en el clon para que el test "survives death across machines" pase en maquinas sin identidad global; (2) bootstrap valida el entorno completo: Node, git, remote, repo, agente espejo, existencia del checkpoint y configuracion git (user.email/user.name), reportando faltantes sin modificar config; (3) estado frozen en vez de blueprint_ready en freeze, con lectura retrocompatible (blueprint_ready sigue aceptado) para no romper checkpoints legacy; commit "- listo" intacto; (4) scaffold enriquecido: cada paso del blueprint lleva los 7 atributos (numero, objetivo, archivos afectados, accion esperada, dependencia previa, criterio de terminacion, gate/verificacion) manteniendo intacta la regex `- [ ] **Paso N:**`; (5) complete con confirmacion de gates (opcion B): el CLI lista los gates obligatorios del manifest governance y exige --confirm-gates para cerrar, ademas escribe el resultado final en Current state; (6) revive con drift detallado (reporta `git log HEAD..origin/<branch> --oneline` cuando el remoto avanzo) y secret scan antes de commitear (patrones sk-, AKIA, BEGIN RSA PRIVATE KEY, password=, token=, client_secret) bloqueando el checkpoint si detecta secretos; (7) gates de calidad (lint, build, unit_tests) y documentacion: AGENTS.md seccion 24, .agents/subaru.md y ADR-021 formalizando el protocolo y resolviendo la contradiccion "no editar a mano" (el blueprint se autoriza ANTES del freeze; el CLI solo estampa frontmatter + commit). NO es reescritura: es endurecimiento incremental de la CLI existente.',
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
  domains: input.affectedDomains,
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
