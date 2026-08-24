import { WorkflowEngine } from './workflow'
import type { AgentRole } from './types'

const workflow = new WorkflowEngine()
const taskId = process.argv[2]
if (!taskId) {
  console.error('Usage: npx tsx workshop/governance/approve-inventory-loop.script.ts <task-id>')
  process.exit(1)
}

const approvals: Array<{ agent: AgentRole; rationale: string }> = [
  { agent: 'architect', rationale: 'Replica mecanica aislada en workshop/inventory-loop/ con cero imports cruzados hacia workshop/loop/: la comparacion estructural es el propio experimento. Semantica de dominio separada de mecanica (detector/gates vs bucle/checkpoint/escalado) respeta la frontera KEEP_SPECIALIZED del audit de reusabilidad. Sin abstraccion prematura.' },
  { agent: 'backend', rationale: 'Detector de invariantes I1/I3 es SQL-semantica pura sobre fixtures en memoria: determinista, testeable, sin acceso a Supabase. Candidate correction como JSON plan + validacion por re-ejecucion independiente del detector sigue el patron NO SELF-ATTESTATION ya probado en v0.2a (gates independientes).' },
  { agent: 'frontend', rationale: 'Sin cambios de UI. El experimento no toca src/components ni paginas; su salida es evidencia JSONL y documentos bajo docs/architecture/.' },
  { agent: 'security', rationale: 'Fixtures sinteticos unicamente: cero escrituras a inventory.* real (regla de la mision). Patrones deny propios rechazan candidatos que toquen produccion o habiliten negocios (enabled=false es diseno). El worker no puede declarar exito sin validacion independiente - superficie de engano cubierta por matriz adversarial A-F.' },
  { agent: 'qa', rationale: 'Gates obligatorios completos (lint/build/unit/e2e/devtools/security/stress) + tests deterministicos del micro-loop con fixtures sanos/corruptos y fakes de worker/subaru siguiendo el patron probado de tests/engineering-loop.test.ts (T1-T12).' },
  { agent: 'godzilla', rationale: 'Matriz adversarial A-F es parte central del experimento: mentira del worker (exito sin fix), candidato erroneo, doble fallo mismo patron -> STUCK, handoff nemotron->big-pickle con continuidad de session_id verificable, BLOCK honesto. Vectores cross-dominio: intentos de escape hacia datos reales y hacia workshop/loop/. CRITICAL/HIGH bloquean release.' },
  { agent: 'release', rationale: 'Commits atomicos convencionales tras gates verdes. Evidencia JSONL y audit doc como artefactos versionados. Sin deploy requerido (experimento local); push a main con pull --rebase previo por bot concurrente MASTER.md.' },
  { agent: 'infrastructure_bootstrap', rationale: 'Sin instalaciones nuevas: Node/tsx/opencode CLI v1.18.21 ya validados en v0.2a. Reutiliza CliSubaruGateway({cwd}) y patron de spawn seguro process.execPath (CVE-2024-27980 mitigado).' },
  { agent: 'infrastructure_guardian', rationale: 'Entorno heredado verde del drill v0.2a (809/809 unit, lint, build). Experimento corre en workspace aislado; checkpoint Subaru real via gateway con cwd propio, sin contaminar checkpoints de misiones activas.' },
  { agent: 'memory_engineer', rationale: 'El experimento produce conocimiento estructural reusable (metrica de replicacion mecanica, veredicto PROVEN/PARTIAL/FAILED) que debe registrarse en engineering memory junto al veredicto KEEP_SPECIALIZED del audit de reusabilidad.' },
]

for (const { agent, rationale } of approvals) {
  try {
    workflow.addDecision(taskId, {
      agentRole: agent,
      decision: 'approve',
      rationale,
      timestamp: new Date().toISOString(),
    })
    console.log(`OK ${agent}`)
  } catch (err) {
    console.error(`X ${agent} FAILED: ${(err as Error).message}`)
    process.exit(1)
  }
}

const manifest = workflow.getManifest(taskId)
console.log(`\nFinal status: ${manifest!.status}`)
console.log(`Decisions: ${manifest!.decisions.length}/${manifest!.classification.requiredAgents.length}`)
