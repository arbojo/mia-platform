import { describe, it, expect } from 'vitest'
import { parsePrice, normalizeRows, mergeErrorCounts, round2 } from '@/lib/import/validators'
import { emptySummary } from '@/lib/import/types'
import type { RawRow } from '@/lib/import/types'

describe('round2', () => {
  it('redondea a 2 decimales', () => {
    expect(round2(10.005)).toBe(10.01)
  })
})

describe('parsePrice', () => {
  it('parsea con punto decimal', () => {
    expect(parsePrice('25.50')).toBe(25.5)
  })
  it('parsea miles con coma y punto', () => {
    expect(parsePrice('1,234.56')).toBe(1234.56)
  })
  it('interpreta coma decimal con máximo 2 decimales', () => {
    expect(parsePrice('25,5')).toBe(25.5)
  })
  it('interpreta coma como separador de miles en "1,234"', () => {
    expect(parsePrice('1,234')).toBe(1234)
  })
  it('interpreta punto como decimal en "1.234"', () => {
    expect(parsePrice('1.234')).toBe(1.23)
  })
  it('acepta números', () => {
    expect(parsePrice(45)).toBe(45)
    expect(parsePrice(45.678)).toBe(45.68)
  })
  it('rechaza valores inválidos', () => {
    expect(parsePrice('abc')).toBeNull()
    expect(parsePrice('-5')).toBeNull()
    expect(parsePrice('')).toBeNull()
  })
})

describe('normalizeRows', () => {
  it('normaliza filas válidas con stockColumnPresent', () => {
    const raw: RawRow[] = [
      { name: '  Perfume ', sku: 'PER-1', price: '25,50', description: ' Fresco ', stock: 10 },
    ]
    const result = normalizeRows(raw, { stockColumnPresent: true })
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toEqual({
      name: 'Perfume',
      sku: 'PER-1',
      price: 25.5,
      description: 'Fresco',
      benefits: null,
      imageUrl: null,
    })
    expect(result.stockDropped).toBe(1)
    expect(result.skipped).toBe(0)
  })

  it('omite filas sin nombre y numera según rowBase', () => {
    const raw: RawRow[] = [{ price: '10' }, { name: 'Valido' }]
    const result = normalizeRows(raw, { stockColumnPresent: false, rowBase: 2 })
    expect(result.rows).toHaveLength(1)
    expect(result.skipped).toBe(1)
    expect(result.errors[0].row).toBe(2)
  })

  it('omite filas con precio inválido', () => {
    const raw: RawRow[] = [{ name: 'Perfume', price: 'gratis' }]
    const result = normalizeRows(raw, { stockColumnPresent: false })
    expect(result.skipped).toBe(1)
    expect(result.errors[0].message).toContain('Precio inválido')
  })

  it('omite filas con imagen inválida', () => {
    const raw: RawRow[] = [{ name: 'Perfume', imageUrl: 'not-a-url' }]
    const result = normalizeRows(raw, { stockColumnPresent: false })
    expect(result.skipped).toBe(1)
    expect(result.errors[0].message).toContain('imagen inválida')
  })

  it('omite filas con nombre demasiado largo', () => {
    const raw: RawRow[] = [{ name: 'X'.repeat(201) }]
    const result = normalizeRows(raw, { stockColumnPresent: false })
    expect(result.skipped).toBe(1)
  })

  it('no cuenta stock si la columna no existe', () => {
    const raw: RawRow[] = [{ name: 'Perfume', stock: 10 }]
    const result = normalizeRows(raw, { stockColumnPresent: false })
    expect(result.stockDropped).toBe(0)
  })
})

describe('mergeErrorCounts', () => {
  it('acumula total, omitidos y stock descartado', () => {
    const summary = emptySummary()
    const raw: RawRow[] = [{ name: 'Perfume' }, { price: 'x' }]
    const result = normalizeRows(raw, { stockColumnPresent: true, rowBase: 2 })
    const merged = mergeErrorCounts(summary, result)
    expect(merged.total).toBe(2)
    expect(merged.skipped).toBe(1)
    expect(merged.errors).toHaveLength(1)
  })
})
