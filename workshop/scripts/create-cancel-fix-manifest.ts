/**
 * Governance Gate — TASK-20260828-CANCEL-LOOP
 *
 * Crea el TaskManifest para el fix del bug "pedido cancelado re-confirmado".
 * Usa el mismo WorkflowEngine del CLI oficial (workshop/governance/cli.ts),
 * garantizando el formato exacto del manifest.
 *
 * Uso: npx tsx workshop/scripts/create-cancel-fix-manifest.ts
 */
import { Orchestrator, type OrchestratorInput } from '../governance/orchestrator'
import { WorkflowEngine } from '../governance/workflow'
import type { BusinessDomain } from '../governance/types'

const input: OrchestratorInput = {
  title: 'Fix: pedido cancelado re-confirmado en conversaciones nuevas',
  description:
    'MIA insiste en confirmar un pedido ya cancelado (clean nails) cuando el cliente inicia conversacion de otro producto. ' +
    '7 causas raiz: (RC1) mensaje falso de cancelacion procesada en process.ts:217; ' +
    '(RC2) memoria del cliente contaminada con mensajes del pedido cancelado (customer-memory.ts:274); ' +
    '(RC3) cancellationContext ambiguo en prompts.ts:362-367 que no prohibe re-confirmar; ' +
    '(RC4) evidence.state no reseteado tras cancelacion (state-loader.ts:11); ' +
    '(RC5) detector de ventas emite SALE_WON sobre pedidos cancelados (detect.ts:38); ' +
    '(RC6) keywords de cancelacion demasiado agresivas (detect.ts:174-181); ' +
    '(RC7) inconsistencia post-cancelacion. ' +
    'Fixes en: process.ts, prompts.ts, cancel.ts, customer-memory.ts, detect.ts.',
  categories: ['bugfix', 'ai_behaviour'],
  filesAffected: 5,
  hasSchemaChanges: false,
  hasAIConsumerChanges: true,
  hasSecurityImplications: false,
  primaryDomain: 'sales',
  affectedDomains: ['sales'],
  technicalDomains: ['backend', 'ai'],
}

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const result = orchestrator.classify(input)

console.log('=== Pre-Flight Summary ===')
console.log(orchestrator.generatePreFlightSummary(result))
console.log()

const manifest = workflow.createManifest(input.title, input.description, {
  categories: input.categories,
  filesAffected: input.filesAffected,
  hasSchemaChanges: input.hasSchemaChanges,
  hasAIConsumerChanges: input.hasAIConsumerChanges,
  hasSecurityImplications: input.hasSecurityImplications,
  isCrossCutting: input.affectedDomains.length > 1,
  primaryDomain: (input.primaryDomain ?? 'sales') as BusinessDomain,
  affectedDomains: input.affectedDomains as BusinessDomain[],
  technicalDomains: input.technicalDomains ?? ['backend'],
}, result)

console.log(`✓ Manifest created: ${manifest.id}`)
console.log(`  Status: ${manifest.status}`)
console.log(`  Complexity: ${manifest.classification.complexity}`)
console.log(`  File: .governance/tasks/${manifest.id}.json`)
console.log()
console.log('Required agents:')
for (const agent of manifest.classification.requiredAgents) {
  console.log(`  → ${agent}`)
}
console.log()
console.log('Required quality gates:')
for (const gate of manifest.classification.qualityGates) {
  console.log(`  → ${gate}`)
}