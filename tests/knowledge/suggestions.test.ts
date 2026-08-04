import { describe, it, expect } from 'vitest'
import {
  resolveSuggestionKind,
  buildApprovalPayload,
  type SuggestionRecord,
} from '@/lib/knowledge/suggestions'

const knowledgeSuggestion: SuggestionRecord = {
  suggested_category: 'faq',
  suggested_question: '¿Tienen envío gratis?',
  suggested_answer: 'Sí, pedidos mayores a $50.',
  suggested_rule_content: null,
}

const ruleSuggestion: SuggestionRecord = {
  suggested_category: null,
  suggested_question: null,
  suggested_answer: null,
  suggested_rule_content: 'Nunca ofrecer descuentos sin autorización.',
}

describe('resolveSuggestionKind', () => {
  it('returns knowledge when rule_content is null', () => {
    expect(resolveSuggestionKind(knowledgeSuggestion)).toBe('knowledge')
  })

  it('returns rule when rule_content is present', () => {
    expect(resolveSuggestionKind(ruleSuggestion)).toBe('rule')
  })
})

describe('buildApprovalPayload', () => {
  describe('knowledge suggestions', () => {
    it('returns knowledge payload from suggested values', () => {
      const result = buildApprovalPayload(knowledgeSuggestion)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.payload.kind).toBe('knowledge')
      expect(result.payload).toMatchObject({
        kind: 'knowledge',
        category: 'faq',
        question: '¿Tienen envío gratis?',
        answer: 'Sí, pedidos mayores a $50.',
        image_url: null,
        trigger_condition: null,
        media_type: 'other',
      })
    })

    it('uses edits to override suggested values', () => {
      const result = buildApprovalPayload(knowledgeSuggestion, {
        category: 'tip',
        question: '¿Hacen entregas?',
        answer: 'Sí, todo CABA.',
      })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.payload.kind).toBe('knowledge')
      expect(result.payload).toMatchObject({
        category: 'tip',
        question: '¿Hacen entregas?',
        answer: 'Sí, todo CABA.',
      })
    })

    it('accepts image_url with trigger_condition', () => {
      const result = buildApprovalPayload(knowledgeSuggestion, {
        image_url: 'https://img.test/a.jpg',
        trigger_condition: 'al mencionar envío',
        media_type: 'image',
      })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.payload.kind).toBe('knowledge')
      expect(result.payload).toMatchObject({
        image_url: 'https://img.test/a.jpg',
        trigger_condition: 'al mencionar envío',
        media_type: 'image',
      })
    })

    it('rejects image_url without trigger_condition', () => {
      const result = buildApprovalPayload(knowledgeSuggestion, {
        image_url: 'https://img.test/a.jpg',
      })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('trigger_condition')
    })

    it('rejects invalid category', () => {
      const result = buildApprovalPayload(knowledgeSuggestion, {
        category: 'invalid_category',
      })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('Categoría inválida')
    })

    it('rejects invalid media_type', () => {
      const result = buildApprovalPayload(knowledgeSuggestion, {
        media_type: 'video',
      })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('Tipo de media inválido')
    })
  })

  describe('rule suggestions', () => {
    it('returns rule payload from suggested values', () => {
      const result = buildApprovalPayload(ruleSuggestion)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.payload).toMatchObject({
        kind: 'rule',
        category: 'restrictions',
        content: 'Nunca ofrecer descuentos sin autorización.',
      })
    })

    it('uses edits.rule_content to override', () => {
      const result = buildApprovalPayload(ruleSuggestion, {
        rule_content: 'Regla actualizada.',
        category: 'promotions',
      })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.payload).toMatchObject({
        kind: 'rule',
        category: 'promotions',
        content: 'Regla actualizada.',
      })
    })

    it('rejects when edited rule_content is empty', () => {
      const result = buildApprovalPayload(ruleSuggestion, {
        rule_content: '',
      })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('contenido para la regla')
    })
  })

  describe('fallback behavior', () => {
    it('returns knowledge with default category when suggested_category is null', () => {
      const suggestion: SuggestionRecord = {
        suggested_category: null,
        suggested_question: '¿Cuánto cuesta?',
        suggested_answer: '$2500.',
        suggested_rule_content: null,
      }
      const result = buildApprovalPayload(suggestion)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.payload.kind).toBe('knowledge')
      expect(result.payload).toMatchObject({ category: 'faq' })
    })

    it('returns knowledge error when question is missing', () => {
      const suggestion: SuggestionRecord = {
        suggested_category: 'faq',
        suggested_question: null,
        suggested_answer: 'Sí.',
        suggested_rule_content: null,
      }
      const result = buildApprovalPayload(suggestion)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('pregunta y respuesta')
    })
  })
})
