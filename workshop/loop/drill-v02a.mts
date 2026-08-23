import { appendEvidence } from './evidence'
import { FileGovernanceChecker } from './governance'
import { NpmGateRunner } from './gates'
import { CliOpenCodeRunner, extractSessionId, type OpenCodeRunner, type RunResult, type RunnerOptions } from './runner'
import { CliSubaruGateway } from './subaru-gateway'
import { runMission } from './run-loop'

const GOV_ID = process.env.DRILL_GOV ?? ''
const MISSION = process.env.DRILL_MISSION ?? 'DRILL-V02A'
const CLONE = process.env.DRILL_CLONE ?? ''
const EVIDENCE_DIR = process.env.DRILL_EVIDENCE ?? ''
const INDUCED_FAILURES = Number(process.env.DRILL_FAILURES ?? '2')

if (!GOV_ID || !CLONE || !EVIDENCE_DIR) {
  console.error('usage: DRILL_GOV=<id> DRILL_CLONE=<clone-path> DRILL_EVIDENCE=<dir> npx tsx workshop/loop/drill-v02a.mts')
  process.exit(1)
}

class OutageFirst implements OpenCodeRunner {
  private calls = 0
  constructor(
    private readonly inner: OpenCodeRunner,
    private readonly inducedFailures: number,
  ) {}

  run(options: RunnerOptions): RunResult {
    this.calls += 1
    if (this.calls <= this.inducedFailures) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: `[simulated outage] deterministic induced failure ${this.calls}/${this.inducedFailures}`,
        timedOut: false,
        durationMs: 5,
      }
    }
    return this.inner.run(options)
  }
}

const realRunner = new CliOpenCodeRunner()
const seedRun = realRunner.run({
  prompt: 'Reply with exactly: READY',
  model: 'opencode/nemotron-3-ultra-free',
  timeoutMs: 300_000,
})
const seedSession = extractSessionId(seedRun.stdout)
if (seedRun.exitCode !== 0 || !seedSession) {
  console.error(`seed failed: exit=${seedRun.exitCode} session=${seedSession ?? 'none'}`)
  process.exit(1)
}

appendEvidence(EVIDENCE_DIR, {
  mission_id: MISSION,
  attempt: 0,
  worker: 'nemotron',
  model: 'opencode/nemotron-3-ultra-free',
  start_time: new Date().toISOString(),
  end_time: new Date().toISOString(),
  result: 'SEED',
  session_id: seedSession,
})

const outcome = runMission(
  {
    missionId: MISSION,
    governanceTaskId: GOV_ID,
    subaruTaskId: MISSION,
    evidenceDir: EVIDENCE_DIR,
    prompt:
      'Confirm you can resume this engineering mission: reply with your model identifier and the word CONTINUED. Do not modify any files.',
    timeoutMs: 300_000,
  },
  {
    runner: new OutageFirst(realRunner, INDUCED_FAILURES),
    gateRunner: new NpmGateRunner(),
    subaru: new CliSubaruGateway({ cwd: CLONE }),
    governance: new FileGovernanceChecker(),
  },
)

console.log(JSON.stringify({ ...outcome, seedSession }, null, 2))
