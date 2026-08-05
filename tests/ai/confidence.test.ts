import { describe, it, expect } from 'vitest'
import {
  calculateEffectiveConfidence,
  isExpired,
  getConfidenceBoostFactor,
} from '@/lib/ai/confidence'

const REFERENCE = '2026-08-04T00:00:00Z'

describe('calculateEffectiveConfidence', () => {
  it('devuelve la confianza base cuando no ha pasado tiempo', () => {
    expect(calculateEffectiveConfidence(90, 'decision', REFERENCE, REFERENCE)).toBe(90)
  })

  it('decae la confianza con el tiempo', () => {
    const old = '2026-02-04T00:00:00Z'
    const effective = calculateEffectiveConfidence(100, 'pattern', old, REFERENCE)
    expect(effective).toBeLessThan(100)
    expect(effective).toBeGreaterThan(10)
  })

  it('respeta el piso de confianza (10)', () => {
    const old = '2000-01-01T00:00:00Z'
    expect(calculateEffectiveConfidence(100, 'pattern', old, REFERENCE)).toBe(10)
  })

  it('clampa al maximo de 100', () => {
    const future = '2026-08-05T00:00:00Z'
    expect(calculateEffectiveConfidence(95, 'decision', future, REFERENCE)).toBe(95)
  })

  it('usa half-life por defecto para tipos desconocidos', () => {
    const old = '2026-03-01T00:00:00Z'
    expect(calculateEffectiveConfidence(80, 'unknown-type', old, REFERENCE)).toBeLessThan(80)
  })
})

describe('isExpired', () => {
  it('devuelve false cuando no hay expiresAt', () => {
    expect(isExpired(null)).toBe(false)
    expect(isExpired(undefined)).toBe(false)
  })

  it('devuelve true cuando ya expiro', () => {
    expect(isExpired('2026-08-01T00:00:00Z', REFERENCE)).toBe(true)
  })

  it('devuelve false cuando aun no expira', () => {
    expect(isExpired('2026-08-10T00:00:00Z', REFERENCE)).toBe(false)
  })
})

describe('getConfidenceBoostFactor', () => {
  it('devuelve 1 sin observaciones', () => {
    expect(getConfidenceBoostFactor(0)).toBe(1)
  })

  it('aplica boost por niveles', () => {
    expect(getConfidenceBoostFactor(5)).toBe(1)
    expect(getConfidenceBoostFactor(10)).toBe(1.05)
    expect(getConfidenceBoostFactor(20)).toBe(1.1)
    expect(getConfidenceBoostFactor(50)).toBe(1.15)
  })
})
