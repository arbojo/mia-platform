import { describe, it, expect } from 'vitest'
import {
  isLearningCorrectionType,
  resolveRuleCategory,
  resolveTeachingContent,
  TEACHING_TARGET,
  type TeachingEvent,
} from '@/lib/knowledge/teaching'

function event(overrides: Partial<TeachingEvent> = {}): TeachingEvent {
  return {
    correction_type: 'mistake_prevention',
    category: null,
    original_response: null,
    corrected_response: null,
    knowledge_change: null,
    ...overrides,
  }
}

describe('resolveTeachingContent', () => {
  it('usa knowledge_change.learning cuando no hay respuesta corregida', () => {
    const content = resolveTeachingContent(
      event({ knowledge_change: { learning: 'No repitas el menu ya respondido' } })
    )
    expect(content).toBe('No repitas el menu ya respondido')
  })

  it('prioriza corrected_response sobre el aprendizaje', () => {
    const content = resolveTeachingContent(
      event({
        corrected_response: '  Respuesta corregida  ',
        knowledge_change: { learning: 'Aprendizaje de respaldo' },
      })
    )
    expect(content).toBe('Respuesta corregida')
  })

  it('devuelve null cuando no hay nada que materializar', () => {
    expect(resolveTeachingContent(event())).toBeNull()
    expect(resolveTeachingContent(event({ knowledge_change: { learning: '   ' } }))).toBeNull()
    expect(resolveTeachingContent(event({ knowledge_change: { learning: 42 } }))).toBeNull()
  })

  it('resuelve los cinco tipos admitidos por la migracion 009', () => {
    for (const type of ['knowledge', 'rule', 'product', 'instruction', 'mistake_prevention'] as const) {
      const content = resolveTeachingContent(
        event({ correction_type: type, knowledge_change: { learning: `texto de ${type}` } })
      )
      expect(content).toBe(`texto de ${type}`)
    }
  })
})

describe('TEACHING_TARGET', () => {
  it('mapea los cinco tipos a una entidad materializable', () => {
    expect(TEACHING_TARGET.knowledge).toBe('knowledge_item')
    expect(TEACHING_TARGET.rule).toBe('sales_rule')
    expect(TEACHING_TARGET.product).toBe('sales_rule')
    expect(TEACHING_TARGET.instruction).toBe('ai_instruction')
    expect(TEACHING_TARGET.mistake_prevention).toBe('ai_instruction')
  })

  it('ningun tipo queda sin destino, que era la causa de los 8 atascados', () => {
    const types = ['knowledge', 'rule', 'product', 'instruction', 'mistake_prevention'] as const
    for (const type of types) {
      expect(TEACHING_TARGET[type]).toBeDefined()
    }
  })
})

describe('resolveRuleCategory', () => {
  it('respeta la categoria del evento cuando existe', () => {
    expect(resolveRuleCategory('rule', 'payment')).toBe('payment')
  })

  it('usa la categoria por defecto segun el tipo', () => {
    expect(resolveRuleCategory('rule', null)).toBe('restrictions')
    expect(resolveRuleCategory('product', null)).toBe('product')
    expect(resolveRuleCategory('mistake_prevention', null)).toBe('restrictions')
  })
})

describe('isLearningCorrectionType', () => {
  it('acepta los cinco tipos y rechaza basura', () => {
    expect(isLearningCorrectionType('mistake_prevention')).toBe(true)
    expect(isLearningCorrectionType('product')).toBe(true)
    expect(isLearningCorrectionType('unknown_type')).toBe(false)
    expect(isLearningCorrectionType('')).toBe(false)
  })
})