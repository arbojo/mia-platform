import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { FileGovernanceChecker, GovernanceViolationError } from './governance'

const TMP_DIR = join(import.meta.dirname, '__tmp_governance_test__')
const TASKS_DIR = join(TMP_DIR, '.governance', 'tasks')

function validManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'TASK-20260827-120000001',
    title: 'Test task',
    description: 'A test task for validation',
    scope: {
      categories: ['bugfix'],
      filesAffected: 1,
      hasSchemaChanges: false,
      hasAIConsumerChanges: false,
      hasSecurityImplications: false,
      isCrossCutting: false,
      primaryDomain: 'sales',
      affectedDomains: ['sales'],
      technicalDomains: ['backend'],
    },
    classification: {
      complexity: 'simple',
      requiredAgents: ['backend', 'qa'],
      qualityGates: ['lint', 'build'],
      rationale: 'Simple bugfix',
    },
    status: 'approved',
    decisions: [],
    createdAt: '2026-08-27T12:00:00.000Z',
    ...overrides,
  }
}

function writeManifest(id: string, data: Record<string, unknown>): string {
  const filePath = join(TASKS_DIR, `${id}.json`)
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  return filePath
}

beforeEach(() => {
  mkdirSync(TASKS_DIR, { recursive: true })
})

afterEach(() => {
  if (existsSync(TMP_DIR)) {
    rmSync(TMP_DIR, { recursive: true, force: true })
  }
})

describe('FileGovernanceChecker', () => {
  const checker = new FileGovernanceChecker(TMP_DIR)

  describe('rejects minimal invalid manifests', () => {
    it('rejects {"status":"approved"}', () => {
      writeManifest('T1', { status: 'approved' })
      expect(() => checker.assertApproved('T1')).toThrow(GovernanceViolationError)
      expect(() => checker.assertApproved('T1')).toThrow(/missing required field 'id'/)
    })

    it('rejects {"status":"approved","id":"x"}', () => {
      writeManifest('T2', { status: 'approved', id: 'x' })
      expect(() => checker.assertApproved('T2')).toThrow(/missing required field 'title'/)
    })

    it('rejects an empty object', () => {
      writeManifest('T3', {})
      expect(() => checker.assertApproved('T3')).toThrow(/missing required field 'id'/)
    })

    it('rejects a JSON array', () => {
      const filePath = join(TASKS_DIR, 'T4.json')
      writeFileSync(filePath, '[]', 'utf-8')
      expect(() => checker.assertApproved('T4')).toThrow(/not a JSON object/)
    })

    it('rejects a JSON string', () => {
      const filePath = join(TASKS_DIR, 'T5.json')
      writeFileSync(filePath, '"approved"', 'utf-8')
      expect(() => checker.assertApproved('T5')).toThrow(/not a JSON object/)
    })

    it('rejects null', () => {
      const filePath = join(TASKS_DIR, 'T6.json')
      writeFileSync(filePath, 'null', 'utf-8')
      expect(() => checker.assertApproved('T6')).toThrow(/not a JSON object/)
    })
  })

  describe('validates required fields individually', () => {
    it('rejects missing description', () => {
      const m = validManifest()
      delete m.description
      writeManifest('T7', m)
      expect(() => checker.assertApproved('T7')).toThrow(/missing required field 'description'/)
    })

    it('rejects missing scope', () => {
      const m = validManifest()
      delete m.scope
      writeManifest('T8', m)
      expect(() => checker.assertApproved('T8')).toThrow(/missing required field 'scope'/)
    })

    it('rejects missing classification', () => {
      const m = validManifest()
      delete m.classification
      writeManifest('T9', m)
      expect(() => checker.assertApproved('T9')).toThrow(/missing required field 'classification'/)
    })

    it('rejects missing decisions', () => {
      const m = validManifest()
      delete m.decisions
      writeManifest('T10', m)
      expect(() => checker.assertApproved('T10')).toThrow(/missing required field 'decisions'/)
    })

    it('rejects missing createdAt', () => {
      const m = validManifest()
      delete m.createdAt
      writeManifest('T11', m)
      expect(() => checker.assertApproved('T11')).toThrow(/missing or invalid 'createdAt'/)
    })

    it('rejects invalid createdAt', () => {
      writeManifest('T12', validManifest({ createdAt: 'not-a-date' }))
      expect(() => checker.assertApproved('T12')).toThrow(/missing or invalid 'createdAt'/)
    })
  })

  describe('validates nested structure', () => {
    it('rejects scope without categories', () => {
      const m = validManifest()
      delete (m.scope as Record<string, unknown>).categories
      writeManifest('T13', m)
      expect(() => checker.assertApproved('T13')).toThrow(/scope missing 'categories'/)
    })

    it('rejects scope without filesAffected', () => {
      const m = validManifest()
      delete (m.scope as Record<string, unknown>).filesAffected
      writeManifest('T14', m)
      expect(() => checker.assertApproved('T14')).toThrow(/scope missing 'filesAffected'/)
    })

    it('rejects scope without affectedDomains', () => {
      const m = validManifest()
      delete (m.scope as Record<string, unknown>).affectedDomains
      writeManifest('T15', m)
      expect(() => checker.assertApproved('T15')).toThrow(/scope missing 'affectedDomains'/)
    })

    it('rejects invalid classification.complexity', () => {
      writeManifest('T16', validManifest({
        classification: {
          complexity: 'invalid',
          requiredAgents: [],
          qualityGates: [],
          rationale: 'test',
        },
      }))
      expect(() => checker.assertApproved('T16')).toThrow(/complexity must be 'simple' or 'complex'/)
    })

    it('rejects missing classification.requiredAgents', () => {
      writeManifest('T17', validManifest({
        classification: {
          complexity: 'simple',
          qualityGates: [],
          rationale: 'test',
        },
      }))
      expect(() => checker.assertApproved('T17')).toThrow(/missing 'requiredAgents'/)
    })

    it('rejects missing classification.qualityGates', () => {
      writeManifest('T18', validManifest({
        classification: {
          complexity: 'simple',
          requiredAgents: [],
          rationale: 'test',
        },
      }))
      expect(() => checker.assertApproved('T18')).toThrow(/missing 'qualityGates'/)
    })

    it('rejects missing classification.rationale', () => {
      writeManifest('T19', validManifest({
        classification: {
          complexity: 'simple',
          requiredAgents: [],
          qualityGates: [],
        },
      }))
      expect(() => checker.assertApproved('T19')).toThrow(/missing 'rationale'/)
    })
  })

  describe('validates status', () => {
    it('rejects invalid status value', () => {
      writeManifest('T20', validManifest({ status: 'banana' }))
      expect(() => checker.assertApproved('T20')).toThrow(/invalid status 'banana'/)
    })

    it('rejects rejected status', () => {
      writeManifest('T21', validManifest({ status: 'rejected' }))
      expect(() => checker.assertApproved('T21')).toThrow(/manifest rejected/)
    })

    it('rejects awaiting_council status', () => {
      writeManifest('T22', validManifest({ status: 'awaiting_council' }))
      expect(() => checker.assertApproved('T22')).toThrow(/manifest awaiting_council/)
    })

    it('rejects in_progress status', () => {
      writeManifest('T23', validManifest({ status: 'in_progress' }))
      expect(() => checker.assertApproved('T23')).toThrow(/manifest in_progress/)
    })

    it('rejects completed status', () => {
      writeManifest('T24', validManifest({ status: 'completed' }))
      expect(() => checker.assertApproved('T24')).toThrow(/manifest completed/)
    })
  })

  describe('accepts valid manifests', () => {
    it('accepts a fully valid approved manifest', () => {
      writeManifest('T30', validManifest())
      expect(() => checker.assertApproved('T30')).not.toThrow()
    })

    it('accepts a complex manifest with decisions', () => {
      writeManifest('T31', validManifest({
        classification: {
          complexity: 'complex',
          requiredAgents: ['architect', 'backend', 'qa', 'godzilla'],
          qualityGates: ['lint', 'build', 'e2e_tests', 'security_review', 'stress_test'],
          rationale: 'Cross-cutting feature',
        },
        decisions: [
          {
            agentRole: 'architect',
            decision: 'approve',
            rationale: 'Looks good',
            timestamp: '2026-08-27T12:00:00.000Z',
          },
          {
            agentRole: 'backend',
            decision: 'approve',
            rationale: 'OK',
            timestamp: '2026-08-27T12:01:00.000Z',
          },
          {
            agentRole: 'qa',
            decision: 'approve',
            rationale: 'Approved',
            timestamp: '2026-08-27T12:02:00.000Z',
          },
          {
            agentRole: 'godzilla',
            decision: 'approve',
            rationale: 'No critical findings',
            timestamp: '2026-08-27T12:03:00.000Z',
          },
        ],
      }))
      expect(() => checker.assertApproved('T31')).not.toThrow()
    })
  })

  describe('file system edge cases', () => {
    it('throws for non-existent manifest', () => {
      expect(() => checker.assertApproved('NONEXISTENT')).toThrow(/manifest missing/)
    })

    it('throws for invalid JSON', () => {
      const filePath = join(TASKS_DIR, 'T40.json')
      writeFileSync(filePath, '{invalid json', 'utf-8')
      expect(() => checker.assertApproved('T40')).toThrow(/invalid JSON/)
    })
  })
})
