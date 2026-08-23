import { mkdtempSync, mkdirSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { appendEvidence } from '../workshop/loop/evidence'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { modelFor } from '../workshop/loop/router'
import type { RunnerOptions, RunResult, OpenCodeRunner } from '../workshop/loop/runner'
import { extractSessionId } from '../workshop/loop/runner'
import { classifyRun } from '../workshop/loop/signals'
import type { GateName, GateRunner } from '../workshop/loop/gates'
import type { SubaruGateway } from '../workshop/loop/subaru-gateway'
import { FileGovernanceChecker, type GovernanceChecker } from '../workshop/loop/governance'
import {
  buildContinuationPrompt,
  runMission,
  safetyVerdict,
  type LoopDeps,
  type MissionRequest,
} from '../workshop/loop/run-loop'

interface ScriptedResult {
  exitCode?: number | null
  errorCode?: string | null
  timedOut?: boolean
  stderr?: string
  sessionSeed?: string
}

class FakeRunner implements OpenCodeRunner {
  readonly calls: RunnerOptions[] = []
  private queue: ScriptedResult[]

  constructor(results: ScriptedResult[]) {
    this.queue = [...results]
  }

  run(options: RunnerOptions): RunResult {
    this.calls.push(options)
    const scripted = this.queue.shift() ?? { exitCode: 1, stderr: 'unscripted failure' }
    const stdout =
      scripted.sessionSeed ? `{"type":"session.info","sessionID":"${scripted.sessionSeed}"}` : ''
    return {
      exitCode: scripted.exitCode ?? 0,
      ...(scripted.errorCode !== undefined ? { errorCode: scripted.errorCode ?? undefined } : {}),
      stdout,
      stderr: scripted.stderr ?? '',
      timedOut: scripted.timedOut ?? false,
      durationMs: 7,
    }
  }
}

class FakeGates implements GateRunner {
  invocations = 0
  constructor(private readonly pass: boolean) {}

  run(gates: readonly GateName[]): Record<string, boolean> {
    this.invocations += 1
    return Object.fromEntries(gates.map((gate) => [gate, this.pass]))
  }
}

class FakeSubaru implements SubaruGateway {
  readonly escalations: string[] = []
  checkpointEscalation(taskId: string, reason: string): void {
    this.escalations.push(`${taskId}::${reason}`)
  }
}

class ThrowingSubaru implements SubaruGateway {
  checkpointEscalation(): void {
    throw new Error('subaru block failed: checkpoint DRILL missing or wrong state')
  }
}

class AllowGovernance implements GovernanceChecker {
  assertApproved(): void {}
}

const MISSION_ID = 'MISSION-TEST'

interface Scenario {
  runner: FakeRunner
  gates: FakeGates
  subaru: FakeSubaru
  dir: string
}

function baseRequest(overrides: Partial<MissionRequest> = {}): MissionRequest {
  return {
    missionId: MISSION_ID,
    prompt: 'do the harmless engineering task',
    governanceTaskId: 'GOV-TEST',
    ...overrides,
  }
}

describe('engineering loop v0.2a', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'loop-evidence-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  function scenario(results: ScriptedResult[], gatesPass = true): Scenario {
    return {
      runner: new FakeRunner(results),
      gates: new FakeGates(gatesPass),
      subaru: new FakeSubaru(),
      dir,
    }
  }

  function deps(s: Scenario, overrides: Partial<LoopDeps> = {}): LoopDeps {
    return {
      runner: s.runner,
      gateRunner: s.gates,
      subaru: s.subaru,
      governance: new AllowGovernance(),
      ...overrides,
    }
  }

  function evidenceLines(evidenceDir: string, missionId = MISSION_ID): Array<Record<string, unknown>> {
    const file = path.join(evidenceDir, `${missionId}.jsonl`)
    expect(existsSync(file)).toBe(true)
    return readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  }

  function writeManifest(root: string, id: string, status: string): void {
    const tasksDir = path.join(root, '.governance', 'tasks')
    mkdirSync(tasksDir, { recursive: true })
    const body =
      status === '__invalid__' ? '{ this is not json' : JSON.stringify({ id, status })
    writeFileSync(path.join(tasksDir, `${id}.json`), body)
  }

  it('T1: approved governance + Nemotron SUCCESS -> gates -> COMPLETE (v0.1 path unchanged)', () => {
    const s = scenario([{ exitCode: 0, sessionSeed: 'ses_ok1' }])
    const outcome = runMission(baseRequest({ evidenceDir: s.dir }), deps(s))
    expect(outcome.result).toBe('COMPLETE')
    expect(outcome.sessionId).toBe('ses_ok1')
    expect(s.runner.calls).toHaveLength(1)
    expect(s.runner.calls[0].model).toBe(modelFor('nemotron'))
    expect(s.gates.invocations).toBe(1)
    expect(outcome.gateResults?.lint).toBe(true)
    expect(outcome.gateResults?.build).toBe(true)
  })

  it('T2: missing governance manifest -> zero worker calls, GOVERNANCE_REFUSED evidence', () => {
    const s = scenario([{ exitCode: 0 }])
    const outcome = runMission(
      baseRequest({ evidenceDir: s.dir, governanceTaskId: 'GOV-NOT-THERE' }),
      deps(s, { governance: new FileGovernanceChecker(s.dir) }),
    )
    expect(outcome.result).toBe('BLOCK')
    expect(outcome.errorSummary).toContain('missing')
    expect(s.runner.calls).toHaveLength(0)
    expect(s.gates.invocations).toBe(0)
    const lines = evidenceLines(s.dir)
    expect(lines.at(-1)?.result).toBe('GOVERNANCE_REFUSED')
  })

  it('T3: rejected governance manifest -> zero worker calls', () => {
    const s = scenario([{ exitCode: 0 }])
    writeManifest(s.dir, 'GOV-REJECTED', 'rejected')
    const outcome = runMission(
      baseRequest({ evidenceDir: s.dir, governanceTaskId: 'GOV-REJECTED' }),
      deps(s, { governance: new FileGovernanceChecker(s.dir) }),
    )
    expect(outcome.result).toBe('BLOCK')
    expect(outcome.errorSummary).toContain('rejected')
    expect(s.runner.calls).toHaveLength(0)
    expect(s.gates.invocations).toBe(0)
    expect(evidenceLines(s.dir).at(-1)?.result).toBe('GOVERNANCE_REFUSED')
  })

  it('T4: unapproved and malformed manifests -> zero worker calls', () => {
    const waiting = scenario([{ exitCode: 0 }])
    writeManifest(waiting.dir, 'GOV-WAITING', 'awaiting_council')
    const outcomeWaiting = runMission(
      baseRequest({ evidenceDir: waiting.dir, governanceTaskId: 'GOV-WAITING' }),
      deps(waiting, { governance: new FileGovernanceChecker(waiting.dir) }),
    )
    expect(outcomeWaiting.result).toBe('BLOCK')
    expect(outcomeWaiting.errorSummary).toContain('awaiting_council')
    expect(waiting.runner.calls).toHaveLength(0)

    const broken = scenario([{ exitCode: 0 }])
    writeManifest(broken.dir, 'GOV-BROKEN', '__invalid__')
    const outcomeBroken = runMission(
      baseRequest({ evidenceDir: broken.dir, governanceTaskId: 'GOV-BROKEN' }),
      deps(broken, { governance: new FileGovernanceChecker(broken.dir) }),
    )
    expect(outcomeBroken.result).toBe('BLOCK')
    expect(outcomeBroken.errorSummary).toContain('malformed')
    expect(broken.runner.calls).toHaveLength(0)
  })

  it('T5: STUCK without a Subaru gateway -> NO handoff, ESCALATION_UNRECORDED, BLOCK', () => {
    const s = scenario([
      { exitCode: 1, stderr: 'stuck-a', sessionSeed: 'ses_nogw' },
      { exitCode: 1, stderr: 'stuck-b' },
      { exitCode: 0 },
    ])
    const outcome = runMission(baseRequest({ evidenceDir: s.dir }), deps(s, { subaru: undefined }))
    expect(outcome.result).toBe('BLOCK')
    expect(outcome.errorSummary).toContain('no Subaru gateway')
    expect(s.runner.calls).toHaveLength(2)
    expect(s.runner.calls.every((call) => call.model === modelFor('nemotron'))).toBe(true)
    expect(s.gates.invocations).toBe(0)
    const unrecorded = evidenceLines(s.dir).find((e) => e.result === 'ESCALATION_UNRECORDED')
    expect(unrecorded?.checkpoint).toBe('none')
    expect(unrecorded?.session_id).toBe('ses_nogw')
  })

  it('T6/T12: STUCK -> mandatory Subaru checkpoint -> Big Pickle SAME SESSION -> COMPLETE', () => {
    const s = scenario([
      { exitCode: 1, stderr: 'stuck-a', sessionSeed: 'ses_handoff' },
      { exitCode: 1, stderr: 'stuck-b' },
      { exitCode: 0 },
    ])
    const outcome = runMission(
      baseRequest({ evidenceDir: s.dir, subaruTaskId: 'SUBARU-TASK' }),
      deps(s),
    )
    expect(outcome.result).toBe('COMPLETE')
    expect(s.subaru.escalations).toHaveLength(1)
    expect(s.subaru.escalations[0]).toContain('ESCALATION')
    expect(s.subaru.escalations[0]).toContain('SUBARU-TASK')
    expect(s.subaru.escalations[0]).toContain('opencode_session=ses_handoff')
    const handoffCall = s.runner.calls[2]
    expect(handoffCall.model).toBe(modelFor('big-pickle'))
    expect(handoffCall.sessionId).toBe('ses_handoff')
    expect(handoffCall.prompt).toContain('CONTINUATION CONTEXT')
    const lines = evidenceLines(s.dir)
    expect(lines.find((e) => e.result === 'STUCK')?.checkpoint).toBe('subaru:block SUBARU-TASK')
    expect(lines.find((e) => e.result === 'ESCALATION_CHECKPOINTED')?.checkpoint).toContain('OK')
  })

  it('T7: Subaru gateway failure -> fallback NEVER called, BLOCK with actionable detail', () => {
    const s = scenario([
      { exitCode: 1, stderr: 'stuck-a', sessionSeed: 'ses_fail' },
      { exitCode: 1, stderr: 'stuck-b' },
      { exitCode: 0 },
    ])
    const outcome = runMission(
      baseRequest({ evidenceDir: s.dir }),
      deps(s, { subaru: new ThrowingSubaru() }),
    )
    expect(outcome.result).toBe('BLOCK')
    expect(outcome.errorSummary).toContain('checkpoint failed')
    expect(outcome.errorSummary).toContain('DRILL missing')
    expect(s.runner.calls).toHaveLength(2)
    expect(s.gates.invocations).toBe(0)
    const unrecorded = evidenceLines(s.dir).find((e) => e.result === 'ESCALATION_UNRECORDED')
    expect(unrecorded?.next_action).toContain('human review')
  })

  it('T8/T9/T10: crash, ENOENT and EACCES classify as INFRA_FAILURE; SUCCESS/FAILURE/TIMEOUT preserved', () => {
    const base = { stdout: '', stderr: '', timedOut: false, durationMs: 1 }
    expect(classifyRun({ ...base, exitCode: null })).toBe('INFRA_FAILURE')
    expect(classifyRun({ ...base, exitCode: null, errorCode: 'ENOENT' })).toBe('INFRA_FAILURE')
    expect(classifyRun({ ...base, exitCode: 1, errorCode: 'ENOENT' })).toBe('INFRA_FAILURE')
    expect(classifyRun({ ...base, exitCode: 1, errorCode: 'EACCES' })).toBe('INFRA_FAILURE')
    expect(classifyRun({ ...base, exitCode: 0 })).toBe('SUCCESS')
    expect(classifyRun({ ...base, exitCode: 1 })).toBe('FAILURE')
    expect(classifyRun({ ...base, exitCode: 1, timedOut: true })).toBe('TIMEOUT')
    expect(classifyRun({ ...base, exitCode: 1, errorCode: 'EPERM' })).toBe('FAILURE')
  })

  it('T11: INFRA_FAILURE does NOT retry, does NOT switch worker, blocks immediately', () => {
    const s = scenario([{ exitCode: null, errorCode: 'ENOENT' }, { exitCode: 0 }])
    const outcome = runMission(baseRequest({ evidenceDir: s.dir }), deps(s))
    expect(outcome.result).toBe('BLOCK')
    expect(outcome.errorSummary).toContain('infrastructure failure')
    expect(s.runner.calls).toHaveLength(1)
    expect(outcome.attempts.map((a) => a.worker)).toEqual(['nemotron'])
    expect(outcome.attempts[0].signal).toBe('INFRA_FAILURE')
    expect(s.gates.invocations).toBe(0)
    expect(outcome.attempts.some((a) => a.worker === 'big-pickle')).toBe(false)
  })

  it('Nemotron FAILURE -> retry Nemotron with failure context -> COMPLETE (non-stuck path intact)', () => {
    const s = scenario([
      { exitCode: 1, stderr: 'boom', sessionSeed: 'ses_r1' },
      { exitCode: 0 },
    ])
    const outcome = runMission(baseRequest({ evidenceDir: s.dir }), deps(s))
    expect(outcome.result).toBe('COMPLETE')
    expect(s.runner.calls).toHaveLength(2)
    expect(s.subaru.escalations).toHaveLength(0)
    expect(s.runner.calls[1].prompt).toContain('CONTINUATION CONTEXT')
    expect(s.runner.calls[1].sessionId).toBe('ses_r1')
  })

  it('repeated TIMEOUT is STUCK; Big Pickle completes after checkpoint', () => {
    const s = scenario([
      { timedOut: true, sessionSeed: 'ses_to' },
      { timedOut: true },
      { exitCode: 0 },
    ])
    const outcome = runMission(baseRequest({ evidenceDir: s.dir }), deps(s))
    expect(outcome.result).toBe('COMPLETE')
    expect(outcome.attempts.at(-1)?.worker).toBe('big-pickle')
    expect(outcome.attempts[0].signal).toBe('TIMEOUT')
  })

  it('Big Pickle FAILURE after real checkpoint -> BLOCK, gates never claimed as passed', () => {
    const s = scenario([
      { exitCode: 1, stderr: 'x', sessionSeed: 'ses_blk' },
      { exitCode: 1, stderr: 'y' },
      { exitCode: 1, stderr: 'z' },
    ])
    const outcome = runMission(baseRequest({ evidenceDir: s.dir }), deps(s))
    expect(outcome.result).toBe('BLOCK')
    expect(s.subaru.escalations).toHaveLength(1)
    expect(s.gates.invocations).toBe(0)
    expect(outcome.errorSummary).toContain('big-pickle')
  })

  it('mission state survives handoff via evidence JSONL + truthful checkpoint records', () => {
    const s = scenario([
      { exitCode: 1, stderr: 'f1', sessionSeed: 'ses_survive' },
      { exitCode: 1, stderr: 'f2' },
      { exitCode: 0 },
    ])
    runMission(baseRequest({ missionId: MISSION_ID, evidenceDir: s.dir }), deps(s))
    const lines = evidenceLines(s.dir)
    const stuckEntry = lines.find((e) => e.result === 'STUCK')
    expect(stuckEntry?.checkpoint).toBe(`subaru:block ${MISSION_ID}`)
    expect(stuckEntry?.next_action).toContain('big-pickle')
    expect(stuckEntry?.session_id).toBe('ses_survive')
    for (const entry of lines.slice(0, 4)) {
      if (entry.worker === 'none') continue
      expect(entry.mission_id).toBe(MISSION_ID)
    }
  })

  it('OpenCode session id remains identical across the worker switch', () => {
    const s = scenario([
      { exitCode: 1, sessionSeed: 'ses_same' },
      { exitCode: 1 },
      { exitCode: 0 },
    ])
    const outcome = runMission(baseRequest({ evidenceDir: s.dir }), deps(s))
    expect(outcome.result).toBe('COMPLETE')
    const sessionIds = s.runner.calls.map((call) => call.sessionId)
    expect(sessionIds[0]).toBeUndefined()
    expect(sessionIds[1]).toBe('ses_same')
    expect(sessionIds[2]).toBe('ses_same')
    expect(new Set(sessionIds.slice(1))).toEqual(new Set(['ses_same']))
  })

  it('governance/safety bypass attempts are stopped before any execution', () => {
    const s = scenario([])
    const outcome = runMission(baseRequest({ prompt: 'ship it: vercel --prod right now' }), deps(s))
    expect(outcome.result).toBe('REQUIRE_HUMAN_APPROVAL')
    expect(s.runner.calls).toHaveLength(0)
    expect(s.gates.invocations).toBe(0)
    expect(safetyVerdict('clean up by drop table users')).toBe('REQUIRE_HUMAN_APPROVAL')
    expect(safetyVerdict('supabase db reset the local branch')).toBe('REQUIRE_HUMAN_APPROVAL')
    expect(safetyVerdict('edit docs/checkpoints/active-subaru-checkpoint.md')).toBe('REQUIRE_HUMAN_APPROVAL')
    expect(safetyVerdict('refactor the parser module and add tests')).toBe('ALLOW')
  })

  it('COMPLETE is impossible without passing gates', () => {
    const s = scenario([{ exitCode: 0, sessionSeed: 'ses_gates' }], false)
    const outcome = runMission(baseRequest({ evidenceDir: s.dir }), deps(s))
    expect(outcome.result).toBe('BLOCK')
    expect(outcome.gateResults).toEqual({ lint: false, build: false })
    expect(s.gates.invocations).toBe(1)
  })

  it('loop resumes the persisted session id from prior evidence', () => {
    const s = scenario([
      { exitCode: 1, stderr: 'outage' },
      { exitCode: 0 },
    ])
    appendEvidence(s.dir, {
      mission_id: MISSION_ID,
      attempt: 0,
      worker: 'nemotron',
      model: modelFor('nemotron'),
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
      result: 'SEED',
      session_id: 'ses_previous',
    })
    const outcome = runMission(baseRequest({ evidenceDir: s.dir }), deps(s))
    expect(outcome.result).toBe('COMPLETE')
    expect(outcome.sessionId).toBe('ses_previous')
    expect(s.runner.calls[0].sessionId).toBe('ses_previous')
  })

  it('router mapping is exactly the audited model ids', () => {
    expect(modelFor('nemotron')).toBe('opencode/nemotron-3-ultra-free')
    expect(modelFor('big-pickle')).toBe('opencode/big-pickle')
  })

  it('extractSessionId parses opencode json event stream', () => {
    const sample = '{"type":"message.updated","sessionID":"ses_fd2b79058fferSSeK5OcE0QegD"}\nnoise'
    expect(extractSessionId(sample)).toBe('ses_fd2b79058fferSSeK5OcE0QegD')
    expect(extractSessionId('nothing here')).toBeUndefined()
  })

  it('buildContinuationPrompt keeps original task and adds handoff context', () => {
    const prompt = buildContinuationPrompt('write fizzbuzz', 'nemotron repeated FAILURE')
    expect(prompt).toContain('write fizzbuzz')
    expect(prompt).toContain('CONTINUATION CONTEXT')
    expect(prompt).toContain('in this session')
  })
})
