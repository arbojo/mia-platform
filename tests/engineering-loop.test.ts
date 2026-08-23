import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { appendEvidence } from '../workshop/loop/evidence'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { modelFor } from '../workshop/loop/router'
import type { RunnerOptions, RunResult, OpenCodeRunner } from '../workshop/loop/runner'
import { extractSessionId } from '../workshop/loop/runner'
import type { GateName, GateRunner } from '../workshop/loop/gates'
import type { SubaruGateway } from '../workshop/loop/subaru-gateway'
import {
  buildContinuationPrompt,
  runMission,
  safetyVerdict,
  type MissionRequest,
} from '../workshop/loop/run-loop'

interface ScriptedResult {
  exitCode?: number | null
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
      scripted.stdout ??
      (scripted.sessionSeed ? `{"type":"session.info","sessionID":"${scripted.sessionSeed}"}` : '')
    return {
      exitCode: scripted.exitCode ?? 0,
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

const MISSION_ID = 'MISSION-TEST'

interface Scenario {
  runner: FakeRunner
  gates: FakeGates
  subaru: FakeSubaru
  dir: string
}

function baseRequest(overrides: Partial<MissionRequest> = {}): MissionRequest {
  return { missionId: MISSION_ID, prompt: 'do the harmless engineering task', ...overrides }
}

describe('engineering loop v0.1', () => {
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

  it('TEST 1: Nemotron SUCCESS -> gates -> COMPLETE', ({ }) => {
    const s = scenario([{ exitCode: 0, sessionSeed: 'ses_ok1' }])
    const outcome = runMission(baseRequest({ evidenceDir: s.dir }), {
      runner: s.runner,
      gateRunner: s.gates,
      subaru: s.subaru,
    })
    expect(outcome.result).toBe('COMPLETE')
    expect(outcome.sessionId).toBe('ses_ok1')
    expect(s.runner.calls).toHaveLength(1)
    expect(s.runner.calls[0].model).toBe(modelFor('nemotron'))
    expect(s.gates.invocations).toBe(1)
    expect(outcome.gateResults?.lint).toBe(true)
    expect(outcome.gateResults?.build).toBe(true)
  })

  it('TEST 2: Nemotron FAILURE -> retry Nemotron with failure context -> COMPLETE', () => {
    const s = scenario([
      { exitCode: 1, stderr: 'boom', sessionSeed: 'ses_r1' },
      { exitCode: 0 },
    ])
    const outcome = runMission(baseRequest({ evidenceDir: s.dir }), {
      runner: s.runner,
      gateRunner: s.gates,
      subaru: s.subaru,
    })
    expect(outcome.result).toBe('COMPLETE')
    expect(s.runner.calls).toHaveLength(2)
    expect(s.subaru.escalations).toHaveLength(0)
    expect(s.runner.calls[1].prompt).toContain('CONTINUATION CONTEXT')
    expect(s.runner.calls[1].sessionId).toBe('ses_r1')
  })

  it('TEST 3: Nemotron STUCK -> Subaru checkpoint -> Big Pickle SAME SESSION -> COMPLETE', () => {
    const s = scenario([
      { exitCode: 1, stderr: 'stuck-a', sessionSeed: 'ses_handoff' },
      { exitCode: 1, stderr: 'stuck-b' },
      { exitCode: 0 },
    ])
    const outcome = runMission(
      baseRequest({ evidenceDir: s.dir, subaruTaskId: 'SUBARU-TASK' }),
      { runner: s.runner, gateRunner: s.gates, subaru: s.subaru },
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
  })

  it('TEST 4: repeated TIMEOUT is STUCK; Big Pickle SUCCESS completes', () => {
    const s = scenario([
      { timedOut: true, sessionSeed: 'ses_to' },
      { timedOut: true },
      { exitCode: 0 },
    ])
    const outcome = runMission(baseRequest({ evidenceDir: s.dir }), {
      runner: s.runner,
      gateRunner: s.gates,
      subaru: s.subaru,
    })
    expect(outcome.result).toBe('COMPLETE')
    expect(outcome.attempts.at(-1)?.worker).toBe('big-pickle')
    expect(outcome.attempts[0].signal).toBe('TIMEOUT')
  })

  it('TEST 5: Big Pickle FAILURE -> BLOCK, gates never claimed as passed', () => {
    const s = scenario([
      { exitCode: 1, stderr: 'x', sessionSeed: 'ses_blk' },
      { exitCode: 1, stderr: 'y' },
      { exitCode: 1, stderr: 'z' },
    ])
    const outcome = runMission(baseRequest({ evidenceDir: s.dir }), {
      runner: s.runner,
      gateRunner: s.gates,
      subaru: s.subaru,
    })
    expect(outcome.result).toBe('BLOCK')
    expect(s.gates.invocations).toBe(0)
    expect(outcome.errorSummary).toContain('big-pickle')
  })

  it('TEST 6: mission state survives handoff via evidence JSONL + Subaru reason', () => {
    const s = scenario([
      { exitCode: 1, stderr: 'f1', sessionSeed: 'ses_survive' },
      { exitCode: 1, stderr: 'f2' },
      { exitCode: 0 },
    ])
    runMission(baseRequest({ missionId: MISSION_ID, evidenceDir: s.dir }), {
      runner: s.runner,
      gateRunner: s.gates,
      subaru: s.subaru,
    })
    const file = path.join(s.dir, `${MISSION_ID}.jsonl`)
    expect(existsSync(file)).toBe(true)
    const lines = readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
    const stuckEntry = lines.find((e) => e.result === 'STUCK')
    expect(stuckEntry.checkpoint).toBe(`subaru:block ${MISSION_ID}`)
    expect(stuckEntry.next_action).toContain('big-pickle')
    expect(stuckEntry.session_id).toBe('ses_survive')
    for (const entry of lines.slice(0, 4)) {
      if (entry.worker === 'none') continue
      expect(entry.mission_id).toBe(MISSION_ID)
    }
  })

  it('TEST 7: OpenCode session id remains identical across the worker switch', () => {
    const s = scenario([
      { exitCode: 1, sessionSeed: 'ses_same' },
      { exitCode: 1 },
      { exitCode: 0 },
    ])
    const outcome = runMission(baseRequest({ evidenceDir: s.dir }), {
      runner: s.runner,
      gateRunner: s.gates,
      subaru: s.subaru,
    })
    expect(outcome.result).toBe('COMPLETE')
    const sessionIds = s.runner.calls.map((call) => call.sessionId)
    expect(sessionIds[0]).toBeUndefined()
    expect(sessionIds[1]).toBe('ses_same')
    expect(sessionIds[2]).toBe('ses_same')
    expect(new Set(sessionIds.slice(1))).toEqual(new Set(['ses_same']))
  })

  it('TEST 8a: governance/safety bypass attempts are stopped before any execution', () => {
    const s = scenario([])
    const outcome = runMission(baseRequest({ prompt: 'ship it: vercel --prod right now' }), {
      runner: s.runner,
      gateRunner: s.gates,
      subaru: s.subaru,
    })
    expect(outcome.result).toBe('REQUIRE_HUMAN_APPROVAL')
    expect(s.runner.calls).toHaveLength(0)
    expect(s.gates.invocations).toBe(0)
    expect(safetyVerdict('clean up by drop table users')).toBe('REQUIRE_HUMAN_APPROVAL')
    expect(safetyVerdict('supabase db reset the local branch')).toBe('REQUIRE_HUMAN_APPROVAL')
    expect(safetyVerdict('edit docs/checkpoints/active-subaru-checkpoint.md')).toBe('REQUIRE_HUMAN_APPROVAL')
    expect(safetyVerdict('refactor the parser module and add tests')).toBe('ALLOW')
  })

  it('TEST 8b: COMPLETE is impossible without passing gates', () => {
    const s = scenario([{ exitCode: 0, sessionSeed: 'ses_gates' }], false)
    const outcome = runMission(baseRequest({ evidenceDir: s.dir }), {
      runner: s.runner,
      gateRunner: s.gates,
      subaru: s.subaru,
    })
    expect(outcome.result).toBe('BLOCK')
    expect(outcome.gateResults).toEqual({ lint: false, build: false })
    expect(s.gates.invocations).toBe(1)
  })

  it('TEST 6b: loop resumes the persisted session id from prior evidence', () => {
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
    const outcome = runMission(baseRequest({ evidenceDir: s.dir }), {
      runner: s.runner,
      gateRunner: s.gates,
      subaru: s.subaru,
    })
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
