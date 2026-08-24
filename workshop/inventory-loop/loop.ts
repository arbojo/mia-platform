import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  anomalySignature,
  detectInventoryAnomalies,
  projectCorrection,
} from './detector'
import { memoryEvidenceSink, type EvidenceSink } from './evidence'
import { parseCandidateCorrection, validateCandidateSafety } from './safety'
import { extractWorkerText } from './opencode-runner'
import type {
  CheckpointOutcome,
  EvidenceRecord,
  FailureReason,
  InventoryFixture,
  InventoryMissionResult,
  LoopSignal,
} from './types'

export interface WorkerRunResult {
  exitCode: number | null
  stdout: string
  stderr: string
  errorCode?: string
  timedOut?: boolean
  sessionId?: string | null
}

export interface WorkerRunner {
  run(request: { prompt: string; model: string; sessionId?: string | null }): Promise<WorkerRunResult>
}

export interface CheckpointGateway {
  checkpoint(reason: string): Promise<void>
}

export interface WorkerDescriptor {
  name: string
  model: string
}

export interface InventoryMissionRequest {
  missionId: string
  governanceTaskId: string
  repoRoot?: string
  fixture: InventoryFixture
  evidencePath: string
  primaryWorker: WorkerDescriptor
  fallbackWorker: WorkerDescriptor
  maxPrimaryAttempts?: number
  maxEscalationAttempts?: number
}

export interface InventoryLoopDeps {
  runner: WorkerRunner
  gateway?: CheckpointGateway
  evidence?: EvidenceSink
  now?: () => Date
}

const DEFAULT_MAX_PRIMARY_ATTEMPTS = 2
const DEFAULT_MAX_ESCALATION_ATTEMPTS = 1
const INFRA_ERROR_CODES = new Set(['ENOENT', 'EACCES'])

class GovernanceRefusedError extends Error {}

function assertApprovedGovernance(repoRoot: string, taskId: string): void {
  const manifestPath = join(repoRoot, '.governance', 'tasks', `${taskId}.json`)
  let raw: string
  try {
    raw = readFileSync(manifestPath, 'utf8')
  } catch {
    throw new GovernanceRefusedError(`governance manifest not found for task ${taskId}`)
  }
  let manifest: unknown
  try {
    manifest = JSON.parse(raw)
  } catch {
    throw new GovernanceRefusedError(`governance manifest for task ${taskId} is malformed`)
  }
  const status =
    typeof manifest === 'object' && manifest !== null && 'status' in manifest
      ? (manifest as Record<string, unknown>).status
      : undefined
  if (typeof status !== 'string' || status.length === 0) {
    throw new GovernanceRefusedError(`governance manifest for task ${taskId} has no status`)
  }
  if (status !== 'approved') {
    throw new GovernanceRefusedError(
      `governance task ${taskId} is '${status}', only 'approved' authorizes execution`,
    )
  }
}

export function buildWorkerPrompt(
  fixture: InventoryFixture,
  anomalies: readonly { kind: string; detail: string }[],
  feedback: string | null,
): string {
  const assetSummary = fixture.assets.map((asset) => ({
    id: asset.id,
    tracking_mode: asset.tracking_mode,
    current_qty: asset.current_qty,
  }))
  const movementSummary = fixture.movements.map((movement) => ({
    id: movement.id,
    asset_id: movement.asset_id,
    quantity_delta: movement.quantity_delta,
    movement_type: movement.movement_type,
  }))
  return [
    'You are diagnosing INVENTORY data inconsistencies inside an ISOLATED FIXTURE (synthetic data, never production).',
    'INVARIANT: every tracking_mode="quantity" asset must satisfy current_qty == sum(quantity_delta of all its movements).',
    'Respond with ONLY a minified JSON object, no prose:',
    '{"diagnosis":"<string>","adjustments":[{"asset_id":"<id>","delta":<integer>,"reason":"<string>"}]}',
    'Your adjustments are appended to the ledger as movement_type="adjustment". You CANNOT modify current_qty directly; you can only reconcile the ledger. Do not touch healthy assets. Every adjustment needs a non-empty reason.',
    `ANOMALIES: ${JSON.stringify(anomalies)}`,
    `FIXTURE: ${JSON.stringify({ assets: assetSummary, movements: movementSummary, ingest_errors: fixture.ingest_errors })}`,
    feedback ? `PREVIOUS ATTEMPT REJECTED — ${feedback}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function isInfraFailure(result: WorkerRunResult): boolean {
  if (result.timedOut === true) return true
  if (result.exitCode === null) return true
  return result.errorCode !== undefined && INFRA_ERROR_CODES.has(result.errorCode)
}

export async function runInventoryMission(
  deps: InventoryLoopDeps,
  request: InventoryMissionRequest,
): Promise<InventoryMissionResult> {
  const now = deps.now ?? (() => new Date())
  const sink = deps.evidence ?? memoryEvidenceSink([])
  const repoRoot = request.repoRoot ?? process.cwd()
  const maxPrimaryAttempts = request.maxPrimaryAttempts ?? DEFAULT_MAX_PRIMARY_ATTEMPTS
  const maxEscalationAttempts = request.maxEscalationAttempts ?? DEFAULT_MAX_ESCALATION_ATTEMPTS

  const startedAt = now()
  let workerCalls = 0
  let attemptsUsed = 0
  let sessionId: string | null = null

  const record = (
    observation: string,
    fields: Partial<EvidenceRecord>,
    nextAction: string,
  ): EvidenceRecord => {
    const timestamp = now()
    const entry: EvidenceRecord = {
      mission_id: request.missionId,
      attempt: null,
      worker: null,
      model: null,
      start_time: startedAt.toISOString(),
      end_time: timestamp.toISOString(),
      duration_ms: timestamp.getTime() - startedAt.getTime(),
      session_id: sessionId,
      observation,
      anomaly: null,
      diagnosis: null,
      candidate: null,
      validation_result: 'NOT_VALIDATED',
      failure_reason: null,
      checkpoint: 'none',
      next_action: nextAction,
      ...fields,
    }
    sink.append(entry)
    return entry
  }

  try {
    assertApprovedGovernance(repoRoot, request.governanceTaskId)
  } catch (error) {
    const reason = error instanceof GovernanceRefusedError ? error.message : String(error)
    record('governance precondition evaluated', { failure_reason: 'GOVERNANCE_REFUSED', validation_result: 'REFUSED' }, `BLOCK: ${reason}`)
    return {
      status: 'BLOCK',
      reason,
      failure_reason: 'GOVERNANCE_REFUSED',
      workerCalls: 0,
      attemptsUsed: 0,
      checkpoint: 'none',
      sessionId: null,
      anomaliesRemaining: [],
    }
  }

  const initialAnomalies = detectInventoryAnomalies(request.fixture)
  record('fixture observed', { anomaly: initialAnomalies }, 'detect anomalies')

  if (initialAnomalies.length === 0) {
    record('no anomalies detected in fixture', {}, 'COMPLETE')
    return {
      status: 'COMPLETE',
      reason: 'NO_ANOMALY',
      failure_reason: null,
      workerCalls: 0,
      attemptsUsed: 0,
      checkpoint: 'none',
      sessionId: null,
      anomaliesRemaining: [],
    }
  }

  let previousFeedback: string | null = null
  let lastFailureKey: string | null = null
  let repeatedFailures = 0

  type AttemptOutcome =
    | { signal: Extract<LoopSignal, 'SUCCESS'>; candidate: unknown; diagnosis: string }
    | { signal: Exclude<LoopSignal, 'SUCCESS'>; feedback: string; failureReason: FailureReason }

  const executeAttempt = async (
    worker: WorkerDescriptor,
    attemptNumber: number,
  ): Promise<AttemptOutcome> => {
    const prompt = buildWorkerPrompt(request.fixture, initialAnomalies, previousFeedback)
    const result = await deps.runner.run({
      prompt,
      model: worker.model,
      sessionId,
    })
    workerCalls += 1
    attemptsUsed = Math.max(attemptsUsed, attemptNumber)
    if (result.sessionId) sessionId = result.sessionId

    if (isInfraFailure(result)) {
      record(
        `worker ${worker.name} infrastructure failure`,
        {
          attempt: attemptNumber,
          worker: worker.name,
          model: worker.model,
          failure_reason: 'INFRA_FAILURE',
          validation_result: 'NOT_REACHED',
        },
        'BLOCK (INFRA_FAILURE -> NO WORKER SWITCH)',
      )
      return { signal: 'INFRA_FAILURE', feedback: '', failureReason: 'INFRA_FAILURE' }
    }

    const parsed = parseCandidateCorrection(extractWorkerText(result.stdout))
    if (!parsed.ok) {
      const excerpt = result.stdout.trim()
        ? ` | stdout_excerpt: ${JSON.stringify(result.stdout.trim().slice(0, 240))}`
        : result.stderr.trim()
          ? ` | stderr_excerpt: ${JSON.stringify(result.stderr.trim().slice(0, 240))}`
          : ' | empty stdout and stderr'
      record(
        `worker ${worker.name} produced unparseable output${excerpt}`,
        {
          attempt: attemptNumber,
          worker: worker.name,
          model: worker.model,
          failure_reason: 'INVALID_CANDIDATE_JSON',
          validation_result: 'PARSE_FAILED',
        },
        'retry with feedback',
      )
      return { signal: 'FAILURE', feedback: parsed.error, failureReason: 'INVALID_CANDIDATE_JSON' }
    }

    const safety = validateCandidateSafety(parsed.candidate, request.fixture)
    if (!safety.ok) {
      record(
        `candidate from ${worker.name} rejected by safety`,
        {
          attempt: attemptNumber,
          worker: worker.name,
          model: worker.model,
          diagnosis: parsed.candidate.diagnosis,
          candidate: parsed.candidate,
          failure_reason: 'SAFETY_REJECTED',
          validation_result: 'SAFETY_DENIED',
        },
        'retry with feedback',
      )
      return {
        signal: 'SAFETY_REJECTED',
        feedback: `SAFETY VIOLATIONS: ${safety.violations.join('; ')}`,
        failureReason: 'SAFETY_REJECTED',
      }
    }

    const projected = projectCorrection(request.fixture, parsed.candidate)
    const remaining = detectInventoryAnomalies(projected)
    if (remaining.length === 0) {
      record(
        'independent detector validated projected state as clean',
        {
          attempt: attemptNumber,
          worker: worker.name,
          model: worker.model,
          diagnosis: parsed.candidate.diagnosis,
          candidate: parsed.candidate,
          validation_result: 'VALIDATED_CLEAN',
        },
        'COMPLETE',
      )
      return { signal: 'SUCCESS', candidate: parsed.candidate, diagnosis: parsed.candidate.diagnosis }
    }

    const signature = anomalySignature(remaining)
    record(
      'projected state still inconsistent after candidate',
      {
        attempt: attemptNumber,
        worker: worker.name,
        model: worker.model,
        diagnosis: parsed.candidate.diagnosis,
        candidate: parsed.candidate,
        anomaly: remaining,
        failure_reason: 'VALIDATION_FAILURE',
        validation_result: 'STILL_DIRTY',
      },
      'retry with feedback',
    )
    return {
      signal: 'FAILURE',
      feedback: `detector still reports: ${signature}`,
      failureReason: 'VALIDATION_FAILURE',
    }
  }

  const finishStuck = async (
    failingWorker: WorkerDescriptor,
  ): Promise<InventoryMissionResult> => {
    if (!deps.gateway) {
      record(
        'stuck without checkpoint gateway configured',
        {
          failure_reason: 'ESCALATION_UNRECORDED',
          validation_result: 'BLOCKED_NO_GATEWAY',
          checkpoint: 'none',
        },
        'BLOCK (NO CHECKPOINT -> NO HANDOFF)',
      )
      return blocked('ESCALATION_UNRECORDED', 'no checkpoint gateway configured', 'none')
    }
    try {
      await deps.gateway.checkpoint(`inventory loop stuck after ${attemptsUsed} attempt(s)`)
    } catch (error) {
      record(
        `checkpoint gateway failed: ${String(error)}`,
        { failure_reason: 'ESCALATION_UNRECORDED', checkpoint: 'none' },
        'BLOCK (NO CHECKPOINT -> NO HANDOFF)',
      )
      return blocked('ESCALATION_UNRECORDED', 'checkpoint gateway failed', 'none')
    }
    record(
      'subaru checkpoint recorded before handoff',
      { checkpoint: 'ESCALATION_CHECKPOINTED', worker: failingWorker.name },
      'escalate to fallback worker',
    )

    for (let attempt = 1; attempt <= maxEscalationAttempts; attempt += 1) {
      const outcome = await executeAttempt(request.fallbackWorker, attempt)
      if (outcome.signal === 'INFRA_FAILURE') {
        return blocked('INFRA_FAILURE', 'fallback worker infrastructure failure', 'ESCALATION_CHECKPOINTED')
      }
      if (outcome.signal === 'SUCCESS') {
        record('fallback worker fix validated', { checkpoint: 'ESCALATION_CHECKPOINTED' }, 'COMPLETE')
        return {
          status: 'COMPLETE',
          reason: 'VALIDATED_AFTER_ESCALATION',
          failure_reason: null,
          workerCalls,
          attemptsUsed,
          checkpoint: 'ESCALATION_CHECKPOINTED',
          sessionId,
          anomaliesRemaining: [],
        }
      }
    }
    record(
      'escalated worker exhausted without valid fix',
      { failure_reason: 'ATTEMPTS_EXHAUSTED', checkpoint: 'ESCALATION_CHECKPOINTED' },
      'BLOCK',
    )
    return blocked('ATTEMPTS_EXHAUSTED', 'escalation exhausted', 'ESCALATION_CHECKPOINTED')
  }

  const blocked = (
    failureReason: FailureReason,
    reason: string,
    checkpoint: CheckpointOutcome,
  ): InventoryMissionResult => ({
    status: 'BLOCK',
    reason,
    failure_reason: failureReason,
    workerCalls,
    attemptsUsed,
    checkpoint,
    sessionId,
    anomaliesRemaining: detectInventoryAnomalies(request.fixture),
  })

  for (let attempt = 1; attempt <= maxPrimaryAttempts; attempt += 1) {
    const outcome = await executeAttempt(request.primaryWorker, attempt)

    if (outcome.signal === 'SUCCESS') {
      return {
        status: 'COMPLETE',
        reason: 'VALIDATED_BY_DETECTOR',
        failure_reason: null,
        workerCalls,
        attemptsUsed,
        checkpoint: 'none',
        sessionId,
        anomaliesRemaining: [],
      }
    }
    if (outcome.signal === 'INFRA_FAILURE') {
      return blocked('INFRA_FAILURE', 'primary worker infrastructure failure', 'none')
    }

    previousFeedback = outcome.feedback
    const key = `${outcome.failureReason}:${outcome.feedback}`
    repeatedFailures = key === lastFailureKey ? repeatedFailures + 1 : 1
    lastFailureKey = key

    if (repeatedFailures >= 2) {
      return finishStuck(request.primaryWorker)
    }
  }

  record(
    'primary attempts exhausted without repeating identical failure',
    { failure_reason: 'ATTEMPTS_EXHAUSTED' },
    'BLOCK',
  )
  return blocked('ATTEMPTS_EXHAUSTED', 'primary attempts exhausted', 'none')
}
