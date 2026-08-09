import { describe, it, expect } from 'vitest'
import {
  parseFrontmatter,
  serializeCheckpoint,
  buildCommitMessage,
  validateStep,
  flipStepCheckbox,
  type CheckpointData,
} from './lib'

const base: CheckpointData = {
  taskId: 'subaru-cli',
  title: 'Test mission',
  state: 'blueprint_ready',
  currentStep: 0,
  totalSteps: 5,
  branch: 'main',
  lastMachine: 'test-machine',
  governanceId: 'TASK-123',
  created: '2026-08-09T00:00:00.000Z',
  updated: '2026-08-09T00:00:00.000Z',
}

describe('parseFrontmatter', () => {
  it('returns empty data and full content when no frontmatter', () => {
    const { data, body } = parseFrontmatter('# Checkpoint\nSin metadata.')
    expect(data).toEqual({})
    expect(body).toBe('# Checkpoint\nSin metadata.')
  })

  it('parses keys as typed values and keeps the body', () => {
    const content = [
      '---',
      'task_id: mia-x',
      'state: in_progress',
      'current_step: 2',
      'total_steps: 7',
      'branch: main',
      '---',
      '',
      '## Body',
      'texto del plan',
    ].join('\n')
    const { data, body } = parseFrontmatter(content)
    expect(data.taskId).toBe('mia-x')
    expect(data.state).toBe('in_progress')
    expect(data.currentStep).toBe(2)
    expect(data.totalSteps).toBe(7)
    expect(data.branch).toBe('main')
    expect(body).toContain('## Body')
    expect(body).toContain('texto del plan')
  })

  it('skips lines without a colon separator', () => {
    const content = ['---', 'task_id: mia-x', 'not-a-key-value', '---', 'body'].join('\n')
    const { data } = parseFrontmatter(content)
    expect(data.taskId).toBe('mia-x')
  })
})

describe('serializeCheckpoint', () => {
  it('round-trips through parseFrontmatter', () => {
    const serialized = serializeCheckpoint(base, '## Plan\n- [ ] **Paso 1:** hacer')
    const { data, body } = parseFrontmatter(serialized)
    expect(data.taskId).toBe('subaru-cli')
    expect(data.state).toBe('blueprint_ready')
    expect(data.currentStep).toBe(0)
    expect(data.totalSteps).toBe(5)
    expect(data.governanceId).toBe('TASK-123')
    expect(data.branch).toBe('main')
    expect(body).toContain('## Plan')
  })

  it('omits governance_id when undefined', () => {
    const serialized = serializeCheckpoint({ ...base, governanceId: undefined }, 'body')
    expect(serialized).not.toContain('governance_id')
  })
})

describe('buildCommitMessage', () => {
  it('maps every state to its Spanish suffix', () => {
    expect(buildCommitMessage('mia-x', 'blueprint_ready')).toBe('subaru: checkpoint mia-x - listo')
    expect(buildCommitMessage('mia-x', 'in_progress')).toBe('subaru: checkpoint mia-x - en-progreso')
    expect(buildCommitMessage('mia-x', 'completed')).toBe('subaru: checkpoint mia-x - completado')
    expect(buildCommitMessage('mia-x', 'blocked')).toBe('subaru: checkpoint mia-x - bloqueado')
  })
})

describe('validateStep', () => {
  it('accepts integer steps within bounds', () => {
    expect(validateStep(1, 5)).toBe(true)
    expect(validateStep(5, 5)).toBe(true)
  })

  it('rejects out-of-range or non-integer steps', () => {
    expect(validateStep(0, 5)).toBe(false)
    expect(validateStep(6, 5)).toBe(false)
    expect(validateStep(1.5, 5)).toBe(false)
  })
})

describe('flipStepCheckbox', () => {
  it('ticks only the matching step checkbox', () => {
    const body = '- [ ] **Paso 1:** a\n- [ ] **Paso 2:** b\n- [ ] **Paso 3:** c'
    const flipped = flipStepCheckbox(body, 2)
    expect(flipped).toContain('- [x] **Paso 2:** b')
    expect(flipped).toContain('- [ ] **Paso 1:** a')
    expect(flipped).toContain('- [ ] **Paso 3:** c')
  })

  it('returns the body unchanged when the step is not found', () => {
    const body = '- [ ] **Paso 1:** a'
    expect(flipStepCheckbox(body, 9)).toBe(body)
  })
})
