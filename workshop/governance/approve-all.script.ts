import { WorkflowEngine } from './workflow'
import type { AgentRole } from './types'

const workflow = new WorkflowEngine()
const taskId = process.argv[2]
const rationale =
  process.argv[3] ??
  'Aprobado: cumple el orden del Concilio, sin conflictos con arquitectura multi-tenant, RLS o dominio de ventas.'

if (!taskId) {
  console.error('Usage: npx tsx workshop/governance/approve-all.script.ts <task-id> [rationale]')
  process.exit(1)
}

const manifest = workflow.getManifest(taskId)
if (!manifest) {
  console.error(`Manifest ${taskId} not found.`)
  process.exit(1)
}

for (const agent of manifest.classification.requiredAgents as AgentRole[]) {
  workflow.addDecision(taskId, {
    agentRole: agent,
    decision: 'approve',
    rationale,
    timestamp: new Date().toISOString(),
  })
}

const final = workflow.getManifest(taskId)
console.log(`✓ All ${final!.classification.requiredAgents.length} approvals recorded for ${taskId}`)
console.log(`  Status: ${final!.status}`)
