import { appendEvidence, lastSessionId, type LoopEvidence } from './evidence'
import { NpmGateRunner, type GateName, type GateRunner } from './gates'
import { FALLBACK_WORKER, PRIMARY_WORKER, modelFor, type WorkerName } from './router'
import { CliOpenCodeRunner, extractSessionId, type OpenCodeRunner } from './runner'
import { classifyRun, detectStuck, type AttemptRecord, type AttemptSignal } from './signals'
import type { SubaruGateway } from './subaru-gateway'

export type MissionResult = 'COMPLETE' | 'BLOCK' | 'REQUIRE_HUMAN_APPROVAL'

export interface MissionRequest {
  missionId: string
  prompt: string
  gates?: readonly GateName[]
  maxPrimaryAttempts?: number
  timeoutMs?: number
  subaruTaskId?: string
  evidenceDir?: string
}

export interface MissionOutcome {
  result: MissionResult
  sessionId?: string
  attempts: AttemptRecord[]
  gateResults?: Record<string, boolean>
  errorSummary?: string
}

export interface LoopDeps {
  runner?: OpenCodeRunner
  gateRunner?: GateRunner
  subaru?: SubaruGateway
  evidenceDir?: string
}

const SAFETY_DENY_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/vercel\s+(--prod|deploy)/i, 'production deployment'],
  [/git\s+push\s+\S*\s*--force/i, 'force push'],
  [/supabase\s+db\s+(reset|push)/i, 'destructive database operation'],
  [/\bdrop\s+(table|database)\b/i, 'destructive database operation'],
  [/(write|edit|overwrite|modify)[^.]*\.env\b/i, 'secret file modification'],
  [/(edit|modify|delete|write)[^.]*(\.governance\/|docs\/checkpoints\/)/i, 'governance state modification'],
]

const DEFAULT_GATES: readonly GateName[] = ['lint', 'build']
const DEFAULT_EVIDENCE_DIR = '.loop-evidence'
const DEFAULT_TIMEOUT_MS = 600_000
const DEFAULT_MAX_PRIMARY_ATTEMPTS = 2

export function safetyVerdict(prompt: string): 'ALLOW' | 'REQUIRE_HUMAN_APPROVAL' {
  for (const [pattern] of SAFETY_DENY_PATTERNS) {
    if (pattern.test(prompt)) return 'REQUIRE_HUMAN_APPROVAL'
  }
  return 'ALLOW'
}

export function buildContinuationPrompt(basePrompt: string, reason: string): string {
  return [
    basePrompt,
    `CONTINUATION CONTEXT: previous worker stopped (${reason}). Continue the SAME task in this session without restarting or duplicating work.`,
  ].join('\n')
}

interface EvidenceMeta {
  sessionId?: string
  gateResults?: Record<string, boolean>
  checkpoint?: string
  nextAction?: string
  errorSummary?: string
}

function record(
  evidenceDir: string,
  missionId: string,
  attempt: number,
  worker: string,
  model: string,
  startedAt: Date,
  result: AttemptSignal | MissionResult,
  meta: EvidenceMeta = {},
): void {
  const entry: LoopEvidence = {
    mission_id: missionId,
    attempt,
    worker,
    model,
    start_time: startedAt.toISOString(),
    end_time: new Date().toISOString(),
    result,
    session_id: meta.sessionId,
    gate_results: meta.gateResults,
    checkpoint: meta.checkpoint,
    next_action: meta.nextAction,
    error_summary: meta.errorSummary,
  }
  for (const key of Object.keys(entry) as (keyof LoopEvidence)[]) {
    if (entry[key] === undefined) delete entry[key]
  }
  appendEvidence(evidenceDir, entry)
}

export function runMission(request: MissionRequest, deps: LoopDeps = {}): MissionOutcome {
  const runner = deps.runner ?? new CliOpenCodeRunner()
  const gateRunner = deps.gateRunner ?? new NpmGateRunner()
  const subaru = deps.subaru
  const evidenceDir = request.evidenceDir ?? deps.evidenceDir ?? DEFAULT_EVIDENCE_DIR
  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxPrimaryAttempts = request.maxPrimaryAttempts ?? DEFAULT_MAX_PRIMARY_ATTEMPTS
  const gates = request.gates ?? DEFAULT_GATES

  const verdict = safetyVerdict(request.prompt)
  if (verdict !== 'ALLOW') {
    record(evidenceDir, request.missionId, 0, 'none', 'none', new Date(), verdict, {
      nextAction: 'human approval required before this task may run',
    })
    return { result: verdict, attempts: [] }
  }

  const attempts: AttemptRecord[] = []
  let stuckReason = ''
  let sessionId = lastSessionId(evidenceDir, request.missionId)
  let workingPrompt = request.prompt

  const finishWithGates = (worker: WorkerName): MissionOutcome => {
    const gateStartedAt = new Date()
    const gateResults = gateRunner.run(gates)
    const allPassed = Object.values(gateResults).every(Boolean)
    const result: MissionResult = allPassed ? 'COMPLETE' : 'BLOCK'
    record(evidenceDir, request.missionId, attempts.length, worker, modelFor(worker), gateStartedAt, result, {
      sessionId,
      gateResults,
      nextAction: allPassed ? 'mission complete' : 'fix failing gates and retry mission',
    })
    return {
      result,
      sessionId,
      attempts,
      gateResults,
      errorSummary: allPassed ? undefined : `gates failed: ${Object.entries(gateResults).filter(([, ok]) => !ok).map(([name]) => name).join(', ')}`,
    }
  }

  const escalate = (): MissionOutcome => {
    const escalationReason = `ESCALATION ${stuckReason}; opencode_session=${sessionId ?? 'unknown'}`
    subaru?.checkpointEscalation(request.subaruTaskId ?? request.missionId, escalationReason)
    record(evidenceDir, request.missionId, attempts.length, PRIMARY_WORKER, modelFor(PRIMARY_WORKER), new Date(), 'STUCK', {
      sessionId,
      checkpoint: `subaru:block ${request.subaruTaskId ?? request.missionId}`,
      nextAction: `hand off to ${FALLBACK_WORKER} on the same session`,
      errorSummary: stuckReason,
    })
    const fallbackStartedAt = new Date()
    const fallbackModel = modelFor(FALLBACK_WORKER)
    const fallbackRun = runner.run({
      prompt: buildContinuationPrompt(request.prompt, stuckReason),
      model: fallbackModel,
      sessionId,
      timeoutMs,
    })
    sessionId = sessionId ?? extractSessionId(fallbackRun.stdout)
    const fallbackSignal = classifyRun(fallbackRun)
    attempts.push({
      worker: FALLBACK_WORKER,
      model: fallbackModel,
      signal: fallbackSignal,
      exitCode: fallbackRun.exitCode,
      durationMs: fallbackRun.durationMs,
    })
    record(evidenceDir, request.missionId, attempts.length - 1, FALLBACK_WORKER, fallbackModel, fallbackStartedAt, fallbackSignal, {
      sessionId,
    })
    if (fallbackSignal !== 'SUCCESS') {
      record(evidenceDir, request.missionId, attempts.length, '-', '-', new Date(), 'BLOCK', {
        sessionId,
        checkpoint: `subaru:block ${request.subaruTaskId ?? request.missionId}`,
        nextAction: 'human review required',
        errorSummary: `${FALLBACK_WORKER} ended with ${fallbackSignal}`,
      })
      return {
        result: 'BLOCK',
        sessionId,
        attempts,
        errorSummary: `${FALLBACK_WORKER} ended with ${fallbackSignal}`,
      }
    }
    return finishWithGates(FALLBACK_WORKER)
  }

  for (let attempt = 1; attempt <= maxPrimaryAttempts; attempt++) {
    const primaryStartedAt = new Date()
    const primaryModel = modelFor(PRIMARY_WORKER)
    const run = runner.run({ prompt: workingPrompt, model: primaryModel, sessionId, timeoutMs })
    sessionId = sessionId ?? extractSessionId(run.stdout)
    const signal = classifyRun(run)
    attempts.push({
      worker: PRIMARY_WORKER,
      model: primaryModel,
      signal,
      exitCode: run.exitCode,
      durationMs: run.durationMs,
    })
    record(evidenceDir, request.missionId, attempts.length - 1, PRIMARY_WORKER, primaryModel, primaryStartedAt, signal, {
      sessionId,
    })
    if (signal === 'SUCCESS') return finishWithGates(PRIMARY_WORKER)
    if (detectStuck(attempts)) {
      stuckReason = `${PRIMARY_WORKER} repeated ${signal}`
      break
    }
    workingPrompt = buildContinuationPrompt(request.prompt, `attempt ${attempt} ended ${signal}`)
  }

  if (!stuckReason) stuckReason = `${PRIMARY_WORKER} exhausted ${maxPrimaryAttempts} attempts`
  return escalate()
}
