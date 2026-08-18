import * as readline from 'node:readline'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'
import type { TaskManifest, GovernanceStatus, AgentRole } from './types'
import { AGENT_LABELS } from './types'

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvLocal()

const PRD_DIR = path.resolve(process.cwd(), 'docs', 'prd')

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

function rl(): readline.Interface {
  return readline.createInterface({ input: process.stdin, output: process.stdout })
}

function ask(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const reader = rl()
    reader.question(prompt, (answer: string) => {
      reader.close()
      resolve(answer)
    })
  })
}

function confirm(prompt: string): Promise<boolean> {
  return ask(`${prompt} (y/N): `).then((a) => a.toLowerCase().startsWith('y'))
}

function printHelp(): void {
  console.log(`
MIA Governance System — Engineering Workflow Enforcer

USAGE:
  npx tsx workshop/governance/cli.ts <command> [options]

COMMANDS:
  classify     Classify a new engineering task
  prd          Generate a PRD from a feature idea
  status       Show task manifest status
  list         List all task manifests
  approve      Approve a task (mark decision)
  reject       Reject a task (mark decision)
  start        Mark task as in_progress
  complete     Mark task as completed
  validate     Validate governance before implementation
  help         Show this help

EXAMPLES:
  npx tsx workshop/governance/cli.ts classify
    → Interactive classification wizard

  npx tsx workshop/governance/cli.ts prd "sistema de entregas"
    → Generate PRD + auto-classify + create TaskManifest

  npx tsx workshop/governance/cli.ts validate TASK-20260729-123456
    → Check if a specific task is approved for implementation

  npx tsx workshop/governance/cli.ts validate
    → Check latest approved task

  npx tsx workshop/governance/cli.ts list
    → List all tasks

  npx tsx workshop/governance/cli.ts status TASK-20260729-123456
    → Show task details

  npx tsx workshop/governance/cli.ts approve TASK-20260729-123456 architect "Looks good"
    → Record architect approval

  npx tsx workshop/governance/cli.ts start TASK-20260729-123456
    → Start implementation

  npx tsx workshop/governance/cli.ts complete TASK-20260729-123456
    → Complete task
`)
}

async function cmdClassify(): Promise<void> {
  console.log()
  console.log('╔══════════════════════════════════════════════╗')
  console.log('║       MIA ORCHESTRATOR — TASK CLASSIFICATION ║')
  console.log('╚══════════════════════════════════════════════╝')
  console.log()

  const title = await ask('Task title: ')
  const description = await ask('Task description: ')

  const filesInput = await ask('Files affected (approximate count): ')
  const filesAffected = parseInt(filesInput) || 1

  const domainsInput = await ask('Affected domains (comma-separated: frontend,backend,database,ai,infrastructure): ')
  const affectedDomains = domainsInput ? domainsInput.split(',').map((s) => s.trim()) : ['unknown']

  const categoriesInput = await ask(
    'Categories (comma-separated): bugfix,feature,refactor,schema_change,ai_behaviour,ui_change,api_change,security,documentation,infrastructure,other\n> '
  )
  const categories = categoriesInput.split(',').map((s) => s.trim()) as OrchestratorInput['categories']

  const hasSchemaChanges = await confirm('Schema changes required?')
  const hasAIConsumerChanges = await confirm('AI behaviour changes?')
  const hasSecurityImplications = await confirm('Security implications?')

  const input: OrchestratorInput = {
    title,
    description,
    categories,
    filesAffected,
    hasSchemaChanges,
    hasAIConsumerChanges,
    hasSecurityImplications,
    affectedDomains,
  }

  const result = orchestrator.classify(input)

  console.log()
  console.log(orchestrator.generatePreFlightSummary(result))
  console.log()

  if (result.complexity === 'simple') {
    console.log('→ SIMPLE TASK: Direct delegation approved.')
    console.log(`→ Lead agent: ${result.requiredAgents[0] || 'unassigned'}`)
    console.log()

    const manifest = workflow.createManifest(title, description, {
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
    console.log('  You may proceed with implementation.')
    console.log(`  Required quality gates: ${result.qualityGates.join(', ')}`)
    console.log()
  } else {
    console.log('→ COMPLEX TASK: Council review required.')
    console.log(`→ Required agents (${result.requiredAgents.length}):`)
    for (const agent of result.requiredAgents) {
      console.log(`    → ${AGENT_LABELS[agent] ?? agent}`)
    }
    console.log()

    const manifest = workflow.createManifest(title, description, {
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
    console.log('  ⚠  Council review is required before implementation.')
    console.log('  Run the following commands to record decisions:')
    console.log()
    for (const agent of result.requiredAgents) {
      console.log(`  npx tsx workshop/governance/cli.ts approve ${manifest.id} ${agent} "..."`)
    }
    console.log()
  }
}

async function cmdPrd(): Promise<void> {
  console.log()
  console.log('╔══════════════════════════════════════════════╗')
  console.log('║       MIA PRD GENERATOR                     ║')
  console.log('╚══════════════════════════════════════════════╝')
  console.log()

  const title = await ask('Feature title: ')
  const description = await ask('Feature description: ')
  const context = await ask('Additional context (optional, press Enter to skip): ')

  console.log()
  console.log('Generating PRD via OpenAI...')

  const { buildPrd, computePrdCost } = await import('../../src/lib/prd/builder')

  const result = await buildPrd({
    title,
    description,
    context: context || undefined,
  })

  const cost = computePrdCost(result.tokensUsed)
  console.log(`✓ PRD generated (${result.tokensUsed.input} in / ${result.tokensUsed.output} out / ~$${cost.toFixed(4)})`)
  console.log()

  if (!result.prd.domainAlignment.inDomain) {
    console.log('⚠  WARNING: This feature is flagged as OUT-OF-DOMAIN per ADR-010.')
    console.log(`   Reason: ${result.prd.domainAlignment.explanation}`)
    console.log()
  }

  const taskId = `TASK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-6)}`
  const filename = `${taskId}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.md`

  if (!fs.existsSync(PRD_DIR)) {
    fs.mkdirSync(PRD_DIR, { recursive: true })
  }

  const prdPath = path.join(PRD_DIR, filename)
  fs.writeFileSync(prdPath, result.markdown, 'utf-8')
  console.log(`✓ PRD saved: ${prdPath}`)
  console.log()

  console.log('Scope extracted from PRD:')
  console.log(`  Categories: ${result.prd.scope.categories.join(', ')}`)
  console.log(`  Files affected: ${result.prd.scope.filesAffected}`)
  console.log(`  Schema changes: ${result.prd.scope.hasSchemaChanges}`)
  console.log(`  AI changes: ${result.prd.scope.hasAIChanges}`)
  console.log(`  Security: ${result.prd.scope.hasSecurityImplications}`)
  console.log(`  Domains: ${result.prd.scope.domains.join(', ')}`)
  console.log()

  const autoClassify = await confirm('Auto-classify with governance?')
  if (!autoClassify) {
    console.log('PRD ready. Run classify manually when ready.')
    return
  }

  const input: OrchestratorInput = {
    title: result.prd.title || title,
    description: result.markdown,
    categories: result.prd.scope.categories as OrchestratorInput['categories'],
    filesAffected: result.prd.scope.filesAffected,
    hasSchemaChanges: result.prd.scope.hasSchemaChanges,
    hasAIConsumerChanges: result.prd.scope.hasAIChanges,
    hasSecurityImplications: result.prd.scope.hasSecurityImplications,
    affectedDomains: result.prd.scope.domains,
  }

  const classifyResult = orchestrator.classify(input)

  console.log(orchestrator.generatePreFlightSummary(classifyResult))
  console.log()

  const manifest = workflow.createManifest(
    input.title,
    input.description,
    {
      categories: input.categories,
      filesAffected: input.filesAffected,
      hasSchemaChanges: input.hasSchemaChanges,
      hasAIConsumerChanges: input.hasAIConsumerChanges,
      hasSecurityImplications: input.hasSecurityImplications,
      isCrossCutting: input.affectedDomains.length > 1,
      domains: input.affectedDomains,
    },
    classifyResult
  )

  console.log(`✓ TaskManifest created: ${manifest.id}`)
  console.log(`  Status: ${manifest.status}`)
  console.log(`  File: .governance/tasks/${manifest.id}.json`)
  console.log()

  if (classifyResult.complexity === 'complex') {
    console.log('⚠  Council review required before implementation.')
    console.log('  Required agents:')
    for (const agent of classifyResult.requiredAgents) {
      console.log(`    → ${AGENT_LABELS[agent] ?? agent}`)
    }
    console.log()
  } else {
    console.log('→ SIMPLE TASK: Direct delegation approved.')
    console.log('  You may proceed with implementation.')
  }
  console.log()
}

function cmdList(): void {
  const statusFilter = process.argv[3] as GovernanceStatus | undefined
  const manifests = workflow.listManifests(statusFilter)

  if (manifests.length === 0) {
    console.log('No task manifests found.')
    return
  }

  console.log()
  console.log(`Task Manifests (${statusFilter ?? 'all statuses'}):`)
  console.log()

  for (const m of manifests) {
    const statusIcon = getStatusIcon(m.status)
    console.log(`  ${statusIcon} ${m.id} — ${m.title}`)
    console.log(`     Status: ${m.status} | Complexity: ${m.classification.complexity}`)
    console.log(`     Created: ${m.createdAt.slice(0, 19)}`)
    if (m.decisions.length > 0) {
      const approved = m.decisions.filter((d) => d.decision === 'approve').length
      const total = m.classification.requiredAgents.length
      console.log(`     Council: ${approved}/${total} approved`)
    }
    console.log()
  }
}

function cmdStatus(): void {
  const manifestId = process.argv[3]
  if (!manifestId) {
    console.error('Usage: npx tsx workshop/governance/cli.ts status <manifest-id>')
    process.exit(1)
  }

  const manifest = workflow.getManifest(manifestId)
  if (!manifest) {
    console.error(`Task manifest ${manifestId} not found.`)
    process.exit(1)
  }

  printManifest(manifest)
}

function cmdApprove(): void {
  const manifestId = process.argv[3]
  const agentRole = process.argv[4] as AgentRole
  const rationale = process.argv.slice(5).join(' ') || 'Approved'

  if (!manifestId || !agentRole) {
    console.error('Usage: npx tsx workshop/governance/cli.ts approve <manifest-id> <agent-role> [rationale]')
    process.exit(1)
  }

  try {
    const manifest = workflow.addDecision(manifestId, {
      agentRole,
      decision: 'approve',
      rationale,
      timestamp: new Date().toISOString(),
    })
    console.log(`✓ ${AGENT_LABELS[agentRole] ?? agentRole} approved.`)
    console.log(`  Status: ${manifest.status}`)

    if (manifest.status === 'approved') {
      console.log('  ✓ All required approvals received! Ready for implementation.')
    }
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`)
    process.exit(1)
  }
}

function cmdReject(): void {
  const manifestId = process.argv[3]
  const agentRole = process.argv[4] as AgentRole
  const rationale = process.argv.slice(5).join(' ') || 'Rejected'

  if (!manifestId || !agentRole) {
    console.error('Usage: npx tsx workshop/governance/cli.ts reject <manifest-id> <agent-role> [rationale]')
    process.exit(1)
  }

  try {
    const manifest = workflow.addDecision(manifestId, {
      agentRole,
      decision: 'reject',
      rationale,
      timestamp: new Date().toISOString(),
    })
    console.log(`✗ ${AGENT_LABELS[agentRole] ?? agentRole} rejected.`)
    console.log(`  Status: ${manifest.status}`)

    if (manifest.status === 'rejected') {
      console.log('  ⚠ Task rejected. Revise and re-classify.')
    }
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`)
    process.exit(1)
  }
}

function cmdStart(): void {
  const manifestId = process.argv[3]
  if (!manifestId) {
    console.error('Usage: npx tsx workshop/governance/cli.ts start <manifest-id>')
    process.exit(1)
  }

  try {
    const manifest = workflow.transition(manifestId, 'in_progress')
    console.log(`✓ Task ${manifestId} started.`)
    printManifest(manifest)
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`)
    process.exit(1)
  }
}

function cmdComplete(): void {
  const manifestId = process.argv[3]
  if (!manifestId) {
    console.error('Usage: npx tsx workshop/governance/cli.ts complete <manifest-id>')
    process.exit(1)
  }

  try {
    const manifest = workflow.transition(manifestId, 'completed')
    console.log(`✓ Task ${manifestId} completed.`)
    printManifest(manifest)
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`)
    process.exit(1)
  }
}

function cmdValidate(): void {
  const manifestId = process.argv[3]

  try {
    const manifest = workflow.assertGovernance(manifestId)
    console.log()
    console.log('╔══════════════════════════════════════════════╗')
    console.log('║       GOVERNANCE CHECK — PASSED             ║')
    console.log('╚══════════════════════════════════════════════╝')
    console.log()
    console.log(`  Task: ${manifest.id} — ${manifest.title}`)
    console.log(`  Status: ${manifest.status}`)
    console.log(`  Complexity: ${manifest.classification.complexity}`)
    console.log()
    console.log('  Implementation is authorized.')
    console.log()
    console.log('  Required quality gates:')
    for (const gate of manifest.classification.qualityGates) {
      console.log(`    → ${gate}`)
    }
    console.log()
  } catch (err) {
    console.log()
    console.log('╔══════════════════════════════════════════════╗')
    console.log('║       GOVERNANCE CHECK — BLOCKED            ║')
    console.log('╚══════════════════════════════════════════════╝')
    console.log()
    console.log(`  ${(err as Error).message}`)
    console.log()
    console.log('  Run `npx tsx workshop/governance/cli.ts classify` to start.')
    console.log()
    process.exit(1)
  }
}

function printManifest(manifest: TaskManifest): void {
  const statusIcon = getStatusIcon(manifest.status)

  console.log()
  console.log(`${statusIcon} Task: ${manifest.id}`)
  console.log(`  Title: ${manifest.title}`)
  console.log(`  Description: ${manifest.description}`)
  console.log(`  Status: ${manifest.status}`)
  console.log(`  Complexity: ${manifest.classification.complexity}`)
  console.log()
  console.log('  Scope:')
  console.log(`    Categories: ${manifest.scope.categories.join(', ')}`)
  console.log(`    Files affected: ${manifest.scope.filesAffected}`)
  console.log(`    Schema changes: ${manifest.scope.hasSchemaChanges}`)
  console.log(`    AI changes: ${manifest.scope.hasAIConsumerChanges}`)
  console.log(`    Security implications: ${manifest.scope.hasSecurityImplications}`)
  console.log(`    Domains: ${manifest.scope.domains.join(', ')}`)
  console.log()
  console.log('  Required agents:')
  for (const agent of manifest.classification.requiredAgents) {
    const decision = manifest.decisions.find((d) => d.agentRole === agent)
    const decisionIcon = decision
      ? (decision.decision === 'approve' ? '✓' : decision.decision === 'reject' ? '✗' : '○')
      : '○'
    console.log(`    ${decisionIcon} ${AGENT_LABELS[agent] ?? agent}${decision ? ` — ${decision.decision}` : ' (pending)'}`)
  }
  console.log()
  console.log('  Quality gates:')
  for (const gate of manifest.classification.qualityGates) {
    console.log(`    → ${gate}`)
  }
  console.log()
  console.log(`  Created: ${manifest.createdAt.slice(0, 19)}`)
  if (manifest.classifiedAt) console.log(`  Classified: ${manifest.classifiedAt.slice(0, 19)}`)
  if (manifest.approvedAt) console.log(`  Approved: ${manifest.approvedAt.slice(0, 19)}`)
  if (manifest.startedAt) console.log(`  Started: ${manifest.startedAt.slice(0, 19)}`)
  if (manifest.completedAt) console.log(`  Completed: ${manifest.completedAt.slice(0, 19)}`)
  if (manifest.rejectedAt) console.log(`  Rejected: ${manifest.rejectedAt.slice(0, 19)}`)
  console.log()
}

function getStatusIcon(status: GovernanceStatus): string {
  switch (status) {
    case 'pending_classification': return '○'
    case 'classified': return '◎'
    case 'awaiting_council': return '⏳'
    case 'council_in_progress': return '🔄'
    case 'approved': return '✓'
    case 'rejected': return '✗'
    case 'in_progress': return '⚡'
    case 'completed': return '✅'
    default: return '●'
  }
}

async function main(): Promise<void> {
  const command = process.argv[2]

  switch (command) {
    case 'classify':
      await cmdClassify()
      break
    case 'prd':
      await cmdPrd()
      break
    case 'list':
      cmdList()
      break
    case 'status':
      cmdStatus()
      break
    case 'approve':
      cmdApprove()
      break
    case 'reject':
      cmdReject()
      break
    case 'start':
      cmdStart()
      break
    case 'complete':
      cmdComplete()
      break
    case 'validate':
      cmdValidate()
      break
    case 'help':
    case '--help':
    case '-h':
      printHelp()
      break
    default:
      console.error(`Unknown command: ${command}`)
      printHelp()
      process.exit(1)
  }
}

main().catch((err) => {
  console.error('Governance CLI error:', err.message)
  process.exit(1)
})
