import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'
import type { BusinessDomain } from './types'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Loop Replication Proof v0.1 - Micro-loop Inventory sobre fixtures sinteticos (replica mecanica aislada del Engineering Loop)',
    description:
      'Experimento forense: probar si los principios mecanicos del Engineering Loop v0.2a replican para el dominio INVENTORY sin tocar el loop existente. Alcance: (1) nuevo directorio aislado workshop/inventory-loop/ con CERO imports desde/hacia workshop/loop/ (la comparacion de lineas sera la metrica de reutilizacion mecanica real); (2) detector determinista de invariantes I1 (drift ledger: current_qty != suma de deltas del ledger por asset quantity-mode) e I3 (ingest_errors acumulados) sobre FIXTURES SINTETICOS en memoria - nunca contra datos reales de Supabase; validado primero contra fixtures sanos (debe pasar) y corruptos (debe fallar); (3) micro-loop: OBSERVE -> DETECT -> worker diagnostica -> candidate_correction JSON (plan de movimientos adjustment) -> validacion INDEPENDIENTE re-ejecutando el detector sobre el estado proyectado -> retry/stuck -> checkpoint Subaru real -> escalado nemotron->big-pickle misma sesion -> revalidacion -> terminal COMPLETE/BLOCK; el worker NO puede declarar exito propio; (4) patrones deny propios del dominio: rechazar candidatos que toquen datos de produccion, que habiliten negocios (enabled=false es diseno, no anomalia), o que declaren exito sin detector; (5) ejecucion adversarial matriz A-F del brief con opencode/nemotron-3-ultra-free PRIMERO; (6) evidencia JSONL docs/architecture/inventory-loop-v0.1-evidence.jsonl + metricas + tabla comparativa vs Engineering Loop + veredicto REPLICATION_PROVEN/PARTIAL/FAILED. Fuera de alcance: modificar workshop/loop/, workshop/subaru/ o reglas de governance; escrituras a datos reales; migraciones de schema; deployments. Precondicion: Fase 0 completa en docs/architecture/inventory-loop-replication-audit-v0.1.md (HEAD 4bdd83b).',
    categories: ['feature', 'infrastructure'],
    filesAffected: 9,
    hasSchemaChanges: false,
    hasAIConsumerChanges: false,
    hasSecurityImplications: true,
    affectedDomains: ['platform', 'inventory'],
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
    primaryDomain: 'inventory',
    affectedDomains: input.affectedDomains as BusinessDomain[],
    technicalDomains: ['backend', 'infrastructure'],
  }, result)
  console.log(`V Manifest created: ${manifest.id} (${manifest.status})`)
}
