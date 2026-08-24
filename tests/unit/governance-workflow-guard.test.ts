import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { WorkflowEngine } from '../../workshop/governance/workflow'
import type { TaskManifest } from '../../workshop/governance/types'
import {
  reconstructContext,
  type ContextReconstructionInput,
} from '../../workshop/governance/context'

let baseDir: string
let engine: WorkflowEngine
let manifestId: string

function createSimpleManifest(engine: WorkflowEngine): string {
  const manifest = engine.createManifest(
    'behavior test mission',
    'deterministic behavior verification',
    {
      categories: ['other'],
      filesAffected: 1,
      hasSchemaChanges: false,
      hasAIConsumerChanges: false,
      hasSecurityImplications: false,
      isCrossCutting: false,
      primaryDomain: 'platform',
      affectedDomains: ['platform'],
      technicalDomains: ['backend'],
    },
    {
      complexity: 'simple',
      requiredAgents: [],
      qualityGates: ['lint', 'build'],
      rationale: 'test fixture',
    }
  )
  return manifest.id
}

function declareApplicableInvariants(engine: WorkflowEngine, id: string, invariantIds: string[]): void {
  const manifest = engine.getManifest(id) as TaskManifest
  manifest.applicableInvariants = invariantIds
  engine.saveManifest(manifest)
}

beforeEach(() => {
  baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gov-guard-'))
  engine = new WorkflowEngine(baseDir)
})

afterEach(() => {
  fs.rmSync(baseDir, { recursive: true, force: true })
})

describe('workflow completion guard', () => {
  it('A: all gates PASS + applicable invariants PASS permits completion', () => {
    manifestId = createSimpleManifest(engine)
    declareApplicableInvariants(engine, manifestId, ['INV-G-003'])
    const ts = new Date().toISOString()
    engine.transition(manifestId, 'in_progress')
    engine.addQualityResult(manifestId, { gate: 'lint', passed: true, timestamp: ts })
    engine.addQualityResult(manifestId, { gate: 'build', passed: true, timestamp: ts })
    engine.addInvariantResult(manifestId, {
      invariant_id: 'INV-G-003',
      status: 'PASS',
      evidence: 'scan clean',
      timestamp: ts,
    })
    const completed = engine.transition(manifestId, 'completed')
    expect(completed.status).toBe('completed')
  })

  it('B: a FAIL quality gate blocks completion', () => {
    manifestId = createSimpleManifest(engine)
    const ts = new Date().toISOString()
    engine.transition(manifestId, 'in_progress')
    engine.addQualityResult(manifestId, { gate: 'lint', passed: true, timestamp: ts })
    engine.addQualityResult(manifestId, { gate: 'build', passed: false, timestamp: ts })
    expect(() => engine.transition(manifestId, 'completed')).toThrow(/'build'.*FAIL/)
  })

  it('C: an UNKNOWN invariant result blocks completion', () => {
    manifestId = createSimpleManifest(engine)
    declareApplicableInvariants(engine, manifestId, ['INV-G-001'])
    const ts = new Date().toISOString()
    engine.transition(manifestId, 'in_progress')
    engine.addQualityResult(manifestId, { gate: 'lint', passed: true, timestamp: ts })
    engine.addQualityResult(manifestId, { gate: 'build', passed: true, timestamp: ts })
    engine.addInvariantResult(manifestId, {
      invariant_id: 'INV-G-001',
      status: 'UNKNOWN',
      evidence: 'exhaustive RLS audit not performed',
      timestamp: ts,
    })
    expect(() => engine.transition(manifestId, 'completed')).toThrow(/UNKNOWN != PASS/)
  })

  it('D: an HUMAN_REQUIRED invariant result blocks completion', () => {
    manifestId = createSimpleManifest(engine)
    declareApplicableInvariants(engine, manifestId, ['INV-G-002'])
    const ts = new Date().toISOString()
    engine.transition(manifestId, 'in_progress')
    engine.addQualityResult(manifestId, { gate: 'lint', passed: true, timestamp: ts })
    engine.addQualityResult(manifestId, { gate: 'build', passed: true, timestamp: ts })
    engine.addInvariantResult(manifestId, {
      invariant_id: 'INV-G-002',
      status: 'HUMAN_REQUIRED',
      evidence: 'policy decision needed',
      timestamp: ts,
    })
    expect(() => engine.transition(manifestId, 'completed')).toThrow(/HUMAN_REQUIRED/)
  })

  it('J: completion without mandatory results is rejected even without declared invariants', () => {
    manifestId = createSimpleManifest(engine)
    engine.transition(manifestId, 'in_progress')
    expect(() => engine.transition(manifestId, 'completed')).toThrow(/no recorded result/)

    declareApplicableInvariants(engine, manifestId, ['INV-G-007'])
    expect(() => engine.transition(manifestId, 'completed')).toThrow(
      /'lint' has no recorded result/
    )
  })

  it('addQualityResult persists results on the manifest (gap closure)', () => {
    manifestId = createSimpleManifest(engine)
    const ts = new Date().toISOString()
    engine.addQualityResult(manifestId, { gate: 'lint', passed: true, timestamp: ts })
    const reloaded = engine.getManifest(manifestId) as TaskManifest
    expect(reloaded.qualityGateResults).toHaveLength(1)
    expect(reloaded.qualityGateResults?.[0].gate).toBe('lint')
    expect(reloaded.qualityGateResults?.[0].passed).toBe(true)
  })
})

describe('context integrity reconstruction', () => {
  const fullInput = (): ContextReconstructionInput => ({
    manifest: {
      missionId: 'MISSION-X',
      objective: 'verify governance invariants with real evidence',
      scopeSummary: 'governance tooling only',
      parentMissionId: null,
      resumePoint: null,
    },
    checkpoint: { taskId: 'MISSION-X', state: 'frozen', currentStep: 3, totalSteps: 10 },
    registry: { invariantIds: ['INV-G-001', 'INV-G-009'] },
    observedForeignPaths: [],
  })

  it('E: consistent sources produce CONTEXT_PASS', () => {
    const report = reconstructContext(fullInput())
    expect(report.status).toBe('CONTEXT_PASS')
    expect(report.missing).toHaveLength(0)
    expect(report.ambiguities).toHaveLength(0)
  })

  it('F: absent checkpoint but sufficient manifest produces CONTEXT_RECOVERY_REQUIRED', () => {
    const input = fullInput()
    input.checkpoint = null
    const report = reconstructContext(input)
    expect(report.status).toBe('CONTEXT_RECOVERY_REQUIRED')
    expect(report.missing).toContain('subaru checkpoint')
  })

  it('G: contradictory sources produce CONTEXT_HUMAN_REQUIRED with ambiguity recorded', () => {
    const input = fullInput()
    input.checkpoint = { taskId: 'MISSION-Y', state: 'frozen', currentStep: 1 }
    const report = reconstructContext(input)
    expect(report.status).toBe('CONTEXT_HUMAN_REQUIRED')
    expect(report.ambiguities[0]).toMatch(/MISSION-X.*MISSION-Y/)
  })

  it('H: foreign dirty paths outside declared scope produce CONTEXT_HUMAN_REQUIRED', () => {
    const input = fullInput()
    input.observedForeignPaths = [
      'services/whatsapp-bridge/src/mia-client.ts',
      'src/lib/system/edition.ts',
    ]
    const report = reconstructContext(input)
    expect(report.status).toBe('CONTEXT_HUMAN_REQUIRED')
    expect(report.protectedPaths).toContain('services/whatsapp-bridge/src/mia-client.ts')
  })

  it('I: pure helper - inputs are never mutated and protectedPaths are preserved verbatim', () => {
    const input = fullInput()
    input.observedForeignPaths = ['src/lib/system/edition.ts']
    input.declaredProtectedPaths = [
      'services/whatsapp-bridge/src/mia-client.ts',
      'src/lib/system/edition.ts',
    ]
    const snapshot = JSON.stringify(input)
    const report = reconstructContext(input)
    expect(JSON.stringify(input)).toBe(snapshot)
    expect(report.protectedPaths).toEqual([
      'services/whatsapp-bridge/src/mia-client.ts',
      'src/lib/system/edition.ts',
    ])
    expect(report.parentMissionId).toBeNull()
  })

  it('declared protected paths do not block; undeclared foreign dirt does', () => {
    const declaredOnly = fullInput()
    declaredOnly.declaredProtectedPaths = ['src/lib/system/edition.ts']
    expect(reconstructContext(declaredOnly).status).toBe('CONTEXT_PASS')

    const withUndeclared = fullInput()
    withUndeclared.observedForeignPaths = ['src/lib/system/edition.ts']
    expect(reconstructContext(withUndeclared).status).toBe('CONTEXT_HUMAN_REQUIRED')
  })

  it('absent manifest always escalates to HUMAN_REQUIRED (MISSING CONTEXT != ASSUMPTION)', () => {
    const report = reconstructContext({ ...fullInput(), manifest: null })
    expect(report.status).toBe('CONTEXT_HUMAN_REQUIRED')
    expect(report.missing).toContain('governance manifest')
  })

  it('parent/resume metadata is carried through when present', () => {
    const input = fullInput()
    input.manifest!.parentMissionId = 'PARENT-V01'
    input.manifest!.resumePoint = 'step 4'
    const report = reconstructContext(input)
    expect(report.parentMissionId).toBe('PARENT-V01')
    expect(report.resumePoint).toBe('step 4')
  })
})
