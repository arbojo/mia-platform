import { describe, it, expect } from 'vitest'
import {
  parseFrontmatter,
  serializeCheckpoint,
  buildCommitMessage,
  validateStep,
  flipStepCheckbox,
  listStepCheckboxes,
  countCheckboxSteps,
  countCheckedSteps,
  findStepCheckbox,
  allStepsChecked,
  missingSteps,
  scaffoldBlueprint,
  readSection,
  readNextAction,
  updateNextAction,
  missingFrontmatterFields,
  type CheckpointData,
  normalizeState,
} from './lib'

const base: CheckpointData = {
  taskId: 'subaru-cli',
  title: 'Test mission',
  state: 'frozen',
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

  it('normalizes legacy blueprint_ready to frozen on read', () => {
    const content = ['---', 'task_id: mia-x', 'state: blueprint_ready', 'total_steps: 2', '---', 'body'].join('\n')
    const { data } = parseFrontmatter(content)
    expect(data.state).toBe('frozen')
  })
})

describe('normalizeState', () => {
  it('treats blueprint_ready as frozen and maps the rest', () => {
    expect(normalizeState('blueprint_ready')).toBe('frozen')
    expect(normalizeState('frozen')).toBe('frozen')
    expect(normalizeState('in_progress')).toBe('in_progress')
    expect(normalizeState('completed')).toBe('completed')
    expect(normalizeState('blocked')).toBe('blocked')
    expect(normalizeState('unknown')).toBeUndefined()
  })
})

describe('serializeCheckpoint', () => {
  it('round-trips through parseFrontmatter', () => {
    const serialized = serializeCheckpoint(base, '## Plan\n- [ ] **Paso 1:** hacer')
    const { data, body } = parseFrontmatter(serialized)
    expect(data.taskId).toBe('subaru-cli')
    expect(data.state).toBe('frozen')
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
    expect(buildCommitMessage('mia-x', 'frozen')).toBe('subaru: checkpoint mia-x - listo')
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

  it('is idempotent when the step is already checked', () => {
    const body = '- [x] **Paso 1:** a\n- [ ] **Paso 2:** b'
    expect(flipStepCheckbox(body, 1)).toBe(body)
  })
})

describe('step checkboxes helpers', () => {
  const body = '- [ ] **Paso 1:** a\n- [x] **Paso 2:** b\n- [x] **Paso 3:** c\n- [ ] **Paso 4:** d'

  it('lists steps with checked state', () => {
    const boxes = listStepCheckboxes(body)
    expect(boxes.map((b) => b.step)).toEqual([1, 2, 3, 4])
    expect(boxes.filter((b) => b.checked).map((b) => b.step)).toEqual([2, 3])
  })

  it('tolerates descriptive suffixes like "Paso 2 (SUBARU):"', () => {
    const sufixed = '- [ ] **Paso 2 (SUBARU):** paso con sufijo\n- [x] **Paso 3 (H):** otro'
    expect(listStepCheckboxes(sufixed).map((b) => b.step)).toEqual([2, 3])
    expect(countCheckedSteps(sufixed)).toBe(1)
    const flipped = flipStepCheckbox(sufixed, 2)
    expect(flipped).toContain('- [x] **Paso 2 (SUBARU):**')
    expect(flipped).toContain('- [x] **Paso 3 (H):**')
    expect(countCheckedSteps(flipped)).toBe(2)
  })

  it('counts total and checked steps', () => {
    expect(countCheckboxSteps(body)).toBe(4)
    expect(countCheckedSteps(body)).toBe(2)
  })

  it('finds a step checkbox by number', () => {
    expect(findStepCheckbox(body, 2)?.checked).toBe(true)
    expect(findStepCheckbox(body, 9)).toBeUndefined()
  })

  it('detects all-checked and missing steps', () => {
    expect(allStepsChecked(body)).toBe(false)
    expect(missingSteps(body)).toEqual([1, 4])
    expect(allStepsChecked('- [x] **Paso 1:** a\n- [x] **Paso 2:** b')).toBe(true)
    expect(allStepsChecked('sin checkboxes')).toBe(false)
  })
})

describe('scaffoldBlueprint', () => {
  const blueprint = scaffoldBlueprint({ taskId: 'mia-x', title: 'Misión X', governanceId: 'TASK-1', steps: 3 })

  it('produces all structural sections', () => {
    for (const heading of ['Mission', 'Scope', 'Non-goals', 'Approved plan', 'Current state', 'Next action', 'Constraints', 'Verification', 'Recovery instructions']) {
      expect(blueprint).toContain(`## ${heading}`)
    }
  })

  it('scaffolds N unchecked atomic steps', () => {
    expect(countCheckboxSteps(blueprint)).toBe(3)
    expect(countCheckedSteps(blueprint)).toBe(0)
  })

  it('can be parsed back via parseFrontmatter round-trip', () => {
    const data: CheckpointData = {
      taskId: 'mia-x',
      title: 'Misión X',
      state: 'frozen',
      currentStep: 0,
      totalSteps: 3,
      branch: 'main',
      lastMachine: 'test-machine',
      governanceId: 'TASK-1',
      created: '2026-08-09T00:00:00.000Z',
      updated: '2026-08-09T00:00:00.000Z',
    }
    const parsed = parseFrontmatter(serializeCheckpoint(data, blueprint))
    expect(parsed.data.taskId).toBe('mia-x')
    expect(countCheckboxSteps(parsed.body)).toBe(3)
  })
})

describe('section helpers', () => {
  const body = [
    '## Mission',
    'misión',
    '',
    '## Next action',
    'Implementar el Paso 2',
    '',
    '## Constraints',
    'no secretos',
  ].join('\n')

  it('reads a section', () => {
    expect(readSection(body, 'Constraints')).toBe('no secretos')
    expect(readSection(body, 'Mission')).toBe('misión')
    expect(readSection(body, 'Inexistente')).toBe('')
  })

  it('reads the next action section', () => {
    expect(readNextAction(body)).toBe('Implementar el Paso 2')
  })

  it('updates only the Next action section', () => {
    const updated = updateNextAction(body, 'Implementar el Paso 3')
    expect(updated).toContain('## Next action\n\nImplementar el Paso 3')
    expect(updated).toContain('## Constraints\nno secretos')
  })

  it('returns the body unchanged when Next action is absent', () => {
    const noSection = '## Mission\nsolo misión'
    expect(updateNextAction(noSection, 'x')).toBe(noSection)
  })
})

describe('missingFrontmatterFields', () => {
  it('flags required fields that are absent', () => {
    const fields = missingFrontmatterFields({ taskId: 'x' })
    expect(fields).toContain('title')
    expect(fields).toContain('state')
    expect(fields).not.toContain('taskId')
  })

  it('returns empty for a complete record', () => {
    expect(
      missingFrontmatterFields({
        taskId: 'x',
        title: 't',
        state: 'in_progress',
        totalSteps: 1,
        branch: 'main',
        created: 'c',
        updated: 'u',
      })
    ).toEqual([])
  })
})
