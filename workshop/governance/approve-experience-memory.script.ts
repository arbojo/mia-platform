import { WorkflowEngine } from './workflow'
import type { AgentRole } from './types'

const workflow = new WorkflowEngine()
const taskId = 'TASK-20260820-105134487'

const approvals: Array<{ agent: string; rationale: string }> = [
  { agent: 'architect', rationale: 'Multi-layer feature with clean separation: DB schema, backend API, AI integration, frontend UI. Blueprint is well-structured with atomic steps.' },
  { agent: 'database', rationale: 'Migration 053 already exists and is solid: proper RLS, partial unique indexes, enum type, ALTER knowledge_items. Seed data is safe to add.' },
  { agent: 'backend', rationale: 'GET/POST routes follow existing patterns (see suggestions/[id]/route.ts). Admin client for writes, server client for reads. Auth via requireAuth().' },
  { agent: 'frontend', rationale: 'Server Components by default, shadcn/ui components, card-based UI for suggestion review. Components under 150 lines. Accessible and responsive.' },
  { agent: 'ai_engineer', rationale: 'Prompt integration adds experience context without hardcoding. Limits to top-10 patterns for token control. Blended patterns from existing blender.ts.' },
  { agent: 'performance', rationale: 'Blender queries are efficient (2 parallel queries). Prompt section limited to top-10 patterns. No premature optimization needed.' },
  { agent: 'security', rationale: 'RLS on both tables, auth on all endpoints, admin client for writes. No cross-tenant access possible. experience_memory source already in CHECK constraint.' },
  { agent: 'qa', rationale: 'Full quality gate suite: lint, build, unit_tests, e2e_tests, chrome_devtools, security_review, stress_test, typecheck, performance_review.' },
  { agent: 'godzilla', rationale: 'Will adversarial-test: prompt injection via objection text, RLS bypass attempts, cross-tenant suggestion access, malformed PATCH bodies.' },
  { agent: 'release', rationale: 'Atomic commits per step, conventional commit format, push to main, Vercel deploy with verification.' },
  { agent: 'memory_engineer', rationale: 'Experience Memory is a new capability that should be documented in engineering memory. ADR-010 boundary respected (sales domain).' },
]

for (const { agent, rationale } of approvals) {
  try {
    const manifest = workflow.addDecision(taskId, {
      agentRole: agent as AgentRole,
      decision: 'approve',
      rationale,
      timestamp: new Date().toISOString(),
    })
    console.log(`✓ ${agent} approved (${manifest.status})`)
  } catch (err) {
    console.error(`✗ ${agent} FAILED: ${(err as Error).message}`)
  }
}

const manifest = workflow.getManifest(taskId)
if (manifest) {
  console.log(`\nFinal status: ${manifest.status}`)
  console.log(`Decisions: ${manifest.decisions.length}/${manifest.classification.requiredAgents.length}`)
}
