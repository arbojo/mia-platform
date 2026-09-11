import { describe, it, expect } from 'vitest'
import { damerauLevenshtein } from '@/lib/runtime/levenshtein'
import {
  compactProductName,
  matchCompactTiers,
  tokenConcats,
  detectsDifferentProductSignal,
} from '@/lib/runtime/product-matcher'

describe('damerauLevenshtein (OSA)', () => {
  it('strings iguales → 0', () => {
    expect(damerauLevenshtein('back2fit', 'back2fit')).toBe(0)
  })

  it('kitten → sitting = 3 (caso clásico Levenshtein)', () => {
    expect(damerauLevenshtein('kitten', 'sitting')).toBe(3)
  })

  it('transposición de adyacentes = 1 (Damerau)', () => {
    expect(damerauLevenshtein('ab', 'ba')).toBe(1)
  })

  it('back2fit → backfit = 1 (insert del dígito)', () => {
    expect(damerauLevenshtein('back2fit', 'backfit')).toBe(1)
  })

  it('back2fit → bachfit = 2 (queda FUERA del umbral <= 1)', () => {
    expect(damerauLevenshtein('back2fit', 'bachfit')).toBe(2)
  })

  it('neurotin → neurofeet = 4 (sin colisión en el catálogo)', () => {
    expect(damerauLevenshtein('neurotin', 'neurofeet')).toBe(4)
  })

  it('strings vacíos', () => {
    expect(damerauLevenshtein('', '')).toBe(0)
    expect(damerauLevenshtein('', 'abc')).toBe(3)
    expect(damerauLevenshtein('abc', '')).toBe(3)
  })
})

describe('product-matcher (capas T2/T4 + señal débil)', () => {
  it('compactProductName: "Clean Nails" → cleannails; "MIA Brain — Evaluation" → miabrainevaluation', () => {
    expect(compactProductName('Clean Nails')).toBe('cleannails')
    expect(compactProductName('MIA Brain — Evaluation')).toBe('miabrainevaluation')
    expect(compactProductName('Back2Fit')).toBe('back2fit')
  })

  it('tokenConcats: ventanas de 1..3 tokens ("back 2 fit" → incluye back2fit)', () => {
    const concats = tokenConcats('quiero ver back 2 fit')
    expect(concats).toContain('back2fit')
    expect(concats).toContain('back')
    expect(concats).toContain('back2')
    expect(concats).toContain('2fit')
  })

  it('matchCompactTiers: compacto exacto → tier compact', () => {
    expect(matchCompactTiers('me pasas cleannails', tokenConcats('me pasas cleannails'), 'cleannails')).toBe(
      'compact'
    )
  })

  it('matchCompactTiers: typo de 1 edición → tier fuzzy', () => {
    expect(matchCompactTiers('hablame de backfit', tokenConcats('hablame de backfit'), 'back2fit')).toBe(
      'fuzzy'
    )
  })

  it('matchCompactTiers: 2 ediciones → null (umbral conservador)', () => {
    expect(matchCompactTiers('tienes el bachfit?', tokenConcats('tienes el bachfit?'), 'back2fit')).toBeNull()
  })

  it('matchCompactTiers: compacto corto (< 6) jamás entra en fuzzy', () => {
    expect(matchCompactTiers('x', tokenConcats('x'), 'faja')).toBeNull()
  })

  const LEXICON = [
    { id: 'p-clean', compact: 'cleannails' },
    { id: 'p-neurotin', compact: 'neurotin' },
    { id: 'p-neurofeet', compact: 'neurofeet' },
    { id: 'p-bella', compact: 'bellapatch' },
    { id: 'p-back', compact: 'back2fit' },
  ]

  it('señal débil: token prefijo de rival con cobertura suficiente ("neuro")', () => {
    expect(
      detectsDifferentProductSignal({
        normalizedMessage: 'me llego el neuro',
        concats: tokenConcats('me llego el neuro'),
        lexicon: LEXICON,
        scopedProductId: 'p-clean',
      })
    ).toBe(true)
  })

  it('señal débil: token corto/vago NO dispara ("back", "bella")', () => {
    expect(
      detectsDifferentProductSignal({
        normalizedMessage: 'trajeron el back?',
        concats: tokenConcats('trajeron el back?'),
        lexicon: LEXICON,
        scopedProductId: 'p-clean',
      })
    ).toBe(false)
    expect(
      detectsDifferentProductSignal({
        normalizedMessage: 'es una bella tarde',
        concats: tokenConcats('es una bella tarde'),
        lexicon: LEXICON,
        scopedProductId: 'p-clean',
      })
    ).toBe(false)
  })

  it('sin réplica rival: mensaje genérico no genera señal', () => {
    expect(
      detectsDifferentProductSignal({
        normalizedMessage: 'y cuanto cuesta?',
        concats: tokenConcats('y cuanto cuesta?'),
        lexicon: LEXICON,
        scopedProductId: 'p-clean',
      })
    ).toBe(false)
  })

  it('señal exacta rival: compacto de otro producto dispara aunque sea sub-umbral', () => {
    expect(
      detectsDifferentProductSignal({
        normalizedMessage: 'la neurofeet duele?',
        concats: tokenConcats('la neurofeet duele?'),
        lexicon: LEXICON,
        scopedProductId: 'p-clean',
      })
    ).toBe(true)
  })
})