import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { basename, delimiter, dirname, join } from 'node:path'
import { fileEvidenceSink } from './evidence'
import { driftedLedgerFixture, mixedCorruptFixture } from './fixtures'
import { CliOpenCodeWorkerRunner } from './opencode-runner'
import { runInventoryMission } from './loop'
import { CliCheckpointGateway } from './subaru-gateway'

const REPO_ROOT = process.cwd()
const WORK = process.env.DRILL_WORK ?? join(REPO_ROOT, '.invloop-drill')
const GOVERNANCE_ID = 'TASK-20260824-002212903'
const CHECKPOINT_ID = 'INVLOOP-EXP-01'
const SCENARIO = process.env.DRILL_SCENARIO ?? 'drift'

function sh(cmd: string, args: string[], cwd?: string): void {
  const result = spawnSync(cmd, args, { encoding: 'utf8', cwd })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} exited ${result.status}: ${(result.stderr || result.stdout || '').slice(-500)}`)
  }
}

function locateTsxNodeModules(): string {
  const candidate = (process.env.PATH ?? '')
    .split(delimiter)
    .map((entry) => (basename(entry) === '.bin' && basename(dirname(entry)) === 'node_modules' ? dirname(entry) : null))
    .find((dir): dir is string => dir !== null && existsSync(join(dir, 'tsx', 'package.json')))
  if (!candidate) {
    throw new Error(
      'tsx not found via PATH; run with: npx tsx workshop/inventory-loop/drill.ts',
    )
  }
  return candidate
}

function prepareSandbox(): string {
  const bareOrigin = join(WORK, 'origin.git')
  const clonePath = join(WORK, 'clone')
  rmSync(WORK, { recursive: true, force: true })
  mkdirSync(bareOrigin, { recursive: true })
  sh('git', ['init', '--bare', '--initial-branch=main'], bareOrigin)
  sh('git', ['clone', '--quiet', bareOrigin, clonePath])
  sh('git', ['config', 'user.email', 'invloop-drill@mia.local'], clonePath)
  sh('git', ['config', 'user.name', 'invloop-drill'], clonePath)
  const manifestSrc = join(REPO_ROOT, '.governance', 'tasks', `${GOVERNANCE_ID}.json`)
  if (!existsSync(manifestSrc)) throw new Error(`governance manifest missing: ${manifestSrc}`)
  mkdirSync(join(clonePath, '.governance', 'tasks'), { recursive: true })
  cpSync(manifestSrc, join(clonePath, '.governance', 'tasks', `${GOVERNANCE_ID}.json`))
  writeFileSync(join(clonePath, 'README.md'), '# invloop drill sandbox\n', 'utf8')
  mkdirSync(join(clonePath, 'docs', 'checkpoints'), { recursive: true })
  sh('git', ['add', '.'], clonePath)
  sh('git', ['commit', '-m', 'chore: sandbox seed with governance manifest'], clonePath)
  symlinkSync(locateTsxNodeModules(), join(clonePath, 'node_modules'), 'junction')
  return clonePath
}

function freezeCheckpoint(clonePath: string): void {
  sh(process.execPath, [
    '--import',
    'tsx',
    join(REPO_ROOT, 'workshop', 'subaru', 'cli.ts'),
    'freeze',
    CHECKPOINT_ID,
    '--title',
    'INVLOOP experiment checkpoint (isolated sandbox)',
    '--steps',
    '1',
    '--governance',
    GOVERNANCE_ID,
  ], clonePath)
}

async function main(): Promise<void> {
  console.log(`[drill] sandbox at ${WORK}`)
  const clonePath = prepareSandbox()
  console.log('[drill] freezing real subaru checkpoint in sandbox')
  freezeCheckpoint(clonePath)

  const fixture = SCENARIO === 'mixed' ? mixedCorruptFixture() : driftedLedgerFixture()
  const evidencePath = join(clonePath, 'evidence.jsonl')

  console.log('[drill] running mission: nemotron first, big-pickle fallback')
  const startedAt = new Date().toISOString()
  const result = await runInventoryMission(
    {
      runner: new CliOpenCodeWorkerRunner(),
      gateway: new CliCheckpointGateway({
        repoRoot: clonePath,
        checkpointId: CHECKPOINT_ID,
        cliPath: join(REPO_ROOT, 'workshop', 'subaru', 'cli.ts'),
      }),
      evidence: fileEvidenceSink(evidencePath),
    },
    {
      missionId: 'INVLOOP-EXP-01',
      governanceTaskId: GOVERNANCE_ID,
      repoRoot: clonePath,
      fixture,
      evidencePath,
      primaryWorker: { name: 'nemotron', model: 'opencode/nemotron-3-ultra-free' },
      fallbackWorker: { name: 'big-pickle', model: 'opencode/big-pickle' },
    },
  )

  writeFileSync(
    join(WORK, 'result.json'),
    JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), result }, null, 2),
    'utf8',
  )
  console.log('[drill] RESULT:', JSON.stringify(result, null, 2))
  console.log(`[drill] evidence: ${evidencePath}`)
}

main().catch((error) => {
  console.error('[drill] FAILED:', error)
  process.exit(1)
})
