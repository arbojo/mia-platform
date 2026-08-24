import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  anomalySignature,
  detectInventoryAnomalies,
} from '../workshop/inventory-loop/detector'
import {
  driftedLedgerFixture,
  ingestErrorsFixture,
  mixedCorruptFixture,
  orphanMovementFixture,
  saneFixture,
} from '../workshop/inventory-loop/fixtures'
import { memoryEvidenceSink, type EvidenceSink } from '../workshop/inventory-loop/evidence'
import type { EvidenceRecord } from '../workshop/inventory-loop/types'
import {
  parseCandidateCorrection,
  validateCandidateSafety,
} from '../workshop/inventory-loop/safety'
import {
  buildWorkerPrompt,
  runInventoryMission,
  type InventoryMissionRequest,
  type InventoryLoopDeps,
  type WorkerRunResult,
  type WorkerRunner,
} from '../workshop/inventory-loop/loop'

interface ScriptedResult {
  stdout?: string
  exitCode?: number | null
  errorCode?: string | null
  timedOut?: boolean
  sessionSeed?: string
}

class FakeRunner implements WorkerRunner {
  readonly requests: Array<{ prompt: string; model: string; sessionId?: string | null }> = []
  private queue: ScriptedResult[]

  constructor(results: ScriptedResult[]) {
    this.queue = [...results]
  }

  async run(request: {
    prompt: string
    model: string
    sessionId?: string | null
  }): Promise<WorkerRunResult> {
    this.requests.push(request)
    const scripted = this.queue.shift() ?? { exitCode: 1, stdout: '' }
    return {
      exitCode: scripted.exitCode ?? 0,
      ...(scripted.errorCode !== undefined ? { errorCode: scripted.errorCode ?? undefined } : {}),
      stdout: scripted.stdout ?? '',
      stderr: '',
      timedOut: scripted.timedOut ?? false,
      sessionId: scripted.sessionSeed ?? null,
    }
  }
}

class AllowGateway {
  calls: string[] = []
  async checkpoint(reason: string): Promise<void> {
    this.calls.push(reason)
  }
}

class ThrowingGateway {
  async checkpoint(): Promise<void> {
    throw new Error('subaru cli exited non-zero')
  }
}

function candidateJson(delta: number): string {
  return JSON.stringify({
    diagnosis: 'ledger drifted below physical count',
    adjustments: [
      { asset_id: 'asset-a1', delta, reason: 'reconcile ledger to physical count' },
    ],
  })
}

describe('inventory invariant detector', () => {
  it('D1: passes a consistent fixture', () => {
    expect(detectInventoryAnomalies(saneFixture())).toEqual([])
  })

  it('D2: detects ledger drift with expected vs actual', () => {
    const anomalies = detectInventoryAnomalies(driftedLedgerFixture())
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0]).toMatchObject({
      kind: 'LEDGER_DRIFT',
      asset_id: 'asset-a1',
      expected_qty: 7,
      actual_qty: 3,
    })
  })

  it('D3: detects accumulated ingest errors', () => {
    const anomalies = detectInventoryAnomalies(ingestErrorsFixture())
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0]!.kind).toBe('INGEST_ERRORS')
    expect(anomalies[0]!.actual_qty).toBe(2)
  })

  it('D4: detects orphan movements', () => {
    const anomalies = detectInventoryAnomalies(orphanMovementFixture())
    expect(anomalies.map((a) => a.kind)).toEqual(['ORPHAN_MOVEMENT'])
  })

  it('D5: detects every anomaly kind in the mixed fixture', () => {
    const kinds = detectInventoryAnomalies(mixedCorruptFixture()).map((a) => a.kind)
    expect(kinds).toContain('LEDGER_DRIFT')
    expect(kinds).toContain('ORPHAN_MOVEMENT')
    expect(kinds).toContain('INGEST_ERRORS')
  })
})

describe('candidate parsing and safety', () => {
  it('parses a valid correction embedded in surrounding prose', () => {
    const parsed = parseCandidateCorrection(`Here is my plan:\n${candidateJson(-4)}\nDone.`)
    expect(parsed.ok).toBe(true)
  })

  it('rejects unknown top-level keys (self-attestation fields)', () => {
    const raw = JSON.stringify({ status: 'fixed', diagnosis: 'x', adjustments: [] })
    expect(parseCandidateCorrection(raw).ok).toBe(false)
  })

  it('safety rejects fabricated assets and forbidden content', () => {
    const parsed = parseCandidateCorrection(
      JSON.stringify({
        diagnosis: 'd',
        adjustments: [
          { asset_id: 'asset-ghost', delta: -1, reason: 'update inventory via supabase' },
        ],
      }),
    )
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      const verdict = validateCandidateSafety(parsed.candidate, saneFixture())
      expect(verdict.ok).toBe(false)
      expect(verdict.violations.length).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('inventory micro-loop mechanics', () => {
  let repoRoot: string
  let evidenceRecords: { records: EvidenceRecord[]; sink: EvidenceSink }

  const GOV_OK = 'TASK-GOV-OK'

  function writeManifest(id: string, status: string): void {
    mkdirSync(path.join(repoRoot, '.governance', 'tasks'), { recursive: true })
    writeFileSync(
      path.join(repoRoot, '.governance', 'tasks', `${id}.json`),
      JSON.stringify({ id, status }),
      'utf8',
    )
  }

  beforeEach(() => {
    repoRoot = mkdtempSync(path.join(os.tmpdir(), 'invloop-test-'))
    writeManifest(GOV_OK, 'approved')
    const records: EvidenceRecord[] = []
    evidenceRecords = { records, sink: memoryEvidenceSink(records) }
  })

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true })
  })

  function missionRequest(
    fixture: ReturnType<typeof saneFixture>,
    overrides: Partial<InventoryMissionRequest> = {},
  ): InventoryMissionRequest {
    return {
      missionId: 'INVTEST-01',
      governanceTaskId: GOV_OK,
      repoRoot,
      fixture,
      evidencePath: path.join(repoRoot, 'evidence.jsonl'),
      primaryWorker: { name: 'nemotron', model: 'opencode/nemotron-3-ultra-free' },
      fallbackWorker: { name: 'big-pickle', model: 'opencode/big-pickle' },
      ...overrides,
    }
  }

  it('T1: blocks before any worker call when governance manifest is missing', async () => {
    const runner = new FakeRunner([])
    const deps: InventoryLoopDeps = { runner, evidence: evidenceRecords.sink }
    const result = await runInventoryMission(deps, {
      ...missionRequest(driftedLedgerFixture()),
      governanceTaskId: 'TASK-MISSING',
    })
    expect(result.status).toBe('BLOCK')
    expect(result.failure_reason).toBe('GOVERNANCE_REFUSED')
    expect(result.workerCalls).toBe(0)
    expect(runner.requests).toHaveLength(0)
  })

  it('T2: blocks when governance manifest is rejected', async () => {
    writeManifest('TASK-REJ', 'rejected')
    const runner = new FakeRunner([])
    const result = await runInventoryMission(
      { runner, evidence: evidenceRecords.sink },
      missionRequest(driftedLedgerFixture(), { governanceTaskId: 'TASK-REJ' }),
    )
    expect(result.status).toBe('BLOCK')
    expect(result.failure_reason).toBe('GOVERNANCE_REFUSED')
  })

  it('T3: completes immediately with zero worker calls on a clean fixture', async () => {
    const runner = new FakeRunner([])
    const result = await runInventoryMission(
      { runner, evidence: evidenceRecords.sink },
      missionRequest(saneFixture()),
    )
    expect(result).toMatchObject({ status: 'COMPLETE', reason: 'NO_ANOMALY', workerCalls: 0 })
  })

  it('T4: completes when the independent detector validates the first candidate', async () => {
    const runner = new FakeRunner([{ stdout: candidateJson(-4), sessionSeed: 'ses_inv_1' }])
    const result = await runInventoryMission(
      { runner, evidence: evidenceRecords.sink },
      missionRequest(driftedLedgerFixture()),
    )
    expect(result.status).toBe('COMPLETE')
    expect(result.reason).toBe('VALIDATED_BY_DETECTOR')
    expect(result.workerCalls).toBe(1)
    expect(result.sessionId).toBe('ses_inv_1')
  })

  it('T5-A+E: lying worker cannot self-certify; stuck triggers real checkpoint then escalation fixes', async () => {
    const lyingOutput = JSON.stringify({
      status: 'fixed',
      summary: 'all done',
    })
    const runner = new FakeRunner([
      { exitCode: 0, stdout: JSON.stringify({ diagnosis: 'fixed it', adjustments: [] }) },
      { exitCode: 0, stdout: JSON.stringify({ diagnosis: 'really fixed', adjustments: [] }) },
      { stdout: candidateJson(-4), sessionSeed: 'ses_bigpickle' },
    ])
    const gateway = new AllowGateway()
    const result = await runInventoryMission(
      { runner, gateway, evidence: evidenceRecords.sink },
      missionRequest(driftedLedgerFixture()),
    )
    expect(result.status).toBe('COMPLETE')
    expect(result.checkpoint).toBe('ESCALATION_CHECKPOINTED')
    expect(gateway.calls).toHaveLength(1)
    expect(runner.requests[2]!.sessionId).not.toBeUndefined()
    expect(runner.requests[2]!.model).toBe('opencode/big-pickle')
    void lyingOutput
  })

  it('T6: stuck without gateway blocks with ESCALATION_UNRECORDED and never calls fallback', async () => {
    const runner = new FakeRunner([
      { stdout: JSON.stringify({ diagnosis: 'd', adjustments: [] }) },
      { stdout: JSON.stringify({ diagnosis: 'd', adjustments: [] }) },
      { stdout: candidateJson(-4) },
    ])
    const result = await runInventoryMission(
      { runner, evidence: evidenceRecords.sink },
      missionRequest(driftedLedgerFixture()),
    )
    expect(result).toMatchObject({
      status: 'BLOCK',
      failure_reason: 'ESCALATION_UNRECORDED',
      checkpoint: 'none',
    })
    expect(runner.requests).toHaveLength(2)
  })

  it('T7: throwing gateway blocks with ESCALATION_UNRECORDED', async () => {
    const runner = new FakeRunner([
      { stdout: JSON.stringify({ diagnosis: 'd', adjustments: [] }) },
      { stdout: JSON.stringify({ diagnosis: 'd', adjustments: [] }) },
    ])
    const result = await runInventoryMission(
      { runner, gateway: new ThrowingGateway(), evidence: evidenceRecords.sink },
      missionRequest(driftedLedgerFixture()),
    )
    expect(result.failure_reason).toBe('ESCALATION_UNRECORDED')
    expect(result.checkpoint).toBe('none')
  })

  it.each([
    ['ENOENT spawn', { exitCode: null, errorCode: 'ENOENT' }],
    ['timeout', { timedOut: true }],
  ])('T8/T9: %s is INFRA_FAILURE -> immediate block, no retry, no handoff', async (_name, script) => {
    const runner = new FakeRunner([script])
    const gateway = new AllowGateway()
    const result = await runInventoryMission(
      { runner, gateway, evidence: evidenceRecords.sink },
      missionRequest(driftedLedgerFixture()),
    )
    expect(result).toMatchObject({ status: 'BLOCK', failure_reason: 'INFRA_FAILURE' })
    expect(runner.requests).toHaveLength(1)
    expect(gateway.calls).toHaveLength(0)
  })

  it('T10-B: unsafe candidates feed the repeated-error rule and terminate BLOCK after escalation fails', async () => {
    const unsafeCandidate = JSON.stringify({
      diagnosis: 'enable the module instead',
      adjustments: [{ asset_id: 'asset-a1', delta: 0, reason: 'flip business_settings enabled' }],
    })
    const runner = new FakeRunner([
      { stdout: unsafeCandidate },
      { stdout: unsafeCandidate },
      { stdout: unsafeCandidate },
    ])
    const gateway = new AllowGateway()
    const result = await runInventoryMission(
      { runner, gateway, evidence: evidenceRecords.sink },
      missionRequest(driftedLedgerFixture()),
    )
    expect(result.status).toBe('BLOCK')
    expect(gateway.calls).toHaveLength(1)
    expect(result.checkpoint).toBe('ESCALATION_CHECKPOINTED')
  })

  it('T11: distinct failures do not trigger stuck; second attempt can validate', async () => {
    const runner = new FakeRunner([
      { stdout: 'garbage output' },
      { stdout: candidateJson(-4) },
    ])
    const result = await runInventoryMission(
      { runner, evidence: evidenceRecords.sink },
      missionRequest(driftedLedgerFixture()),
    )
    expect(result.status).toBe('COMPLETE')
    expect(result.attemptsUsed).toBe(2)
  })

  it('T12-F: escalated fallback failing too terminates BLOCK with checkpoint recorded', async () => {
    const wrongDirection = candidateJson(4)
    const runner = new FakeRunner([
      { stdout: JSON.stringify({ diagnosis: 'd', adjustments: [] }) },
      { stdout: JSON.stringify({ diagnosis: 'd', adjustments: [] }) },
      { stdout: wrongDirection },
    ])
    const result = await runInventoryMission(
      { runner, gateway: new AllowGateway(), evidence: evidenceRecords.sink },
      missionRequest(driftedLedgerFixture()),
    )
    expect(result.status).toBe('BLOCK')
    expect(result.checkpoint).toBe('ESCALATION_CHECKPOINTED')
    expect(result.anomaliesRemaining).toHaveLength(1)
  })

  it('T13: session id propagates across attempts within the same mission', async () => {
    const runner = new FakeRunner([
      { stdout: 'garbage', sessionSeed: 'ses_shared' },
      { stdout: candidateJson(-4) },
    ])
    await runInventoryMission(
      { runner, evidence: evidenceRecords.sink },
      missionRequest(driftedLedgerFixture()),
    )
    expect(runner.requests[0]!.sessionId).toBeNull()
    expect(runner.requests[1]!.sessionId).toBe('ses_shared')
  })

  it('records evidence for every decision point including refusal paths', async () => {
    const runner = new FakeRunner([{ stdout: candidateJson(-4) }])
    await runInventoryMission(
      { runner, evidence: evidenceRecords.sink },
      missionRequest(driftedLedgerFixture()),
    )
    const observations = evidenceRecords.records.map((r) => r.observation as string)
    expect(observations.some((o) => o.includes('fixture observed'))).toBe(true)
    expect(observations.some((o) => o.includes('validated'))).toBe(true)
  })
})

describe('anomaly signature stability', () => {
  it('produces identical signatures for identical anomalies and different ones otherwise', () => {
    const a = detectInventoryAnomalies(driftedLedgerFixture())
    const b = detectInventoryAnomalies(driftedLedgerFixture())
    expect(anomalySignature(a)).toBe(anomalySignature(b))
    expect(anomalySignature(a)).not.toBe(anomalySignature(detectInventoryAnomalies(mixedCorruptFixture())))
  })
})

describe('worker prompt contract', () => {
  it('forbids direct current_qty edits and demands strict JSON', () => {
    const prompt = buildWorkerPrompt(driftedLedgerFixture(), detectInventoryAnomalies(driftedLedgerFixture()), null)
    expect(prompt).toContain('CANNOT modify current_qty directly')
    expect(prompt).toContain('"diagnosis"')
    expect(prompt).toContain('LEDGER_DRIFT')
  })
})
