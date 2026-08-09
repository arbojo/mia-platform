import { describe, it, expect } from 'vitest'
import { parseQuantity, buildImportRows } from '@/lib/inventory/import'

describe('parseQuantity', () => {
  it('parses integer numbers', () => {
    expect(parseQuantity(12)).toBe(12)
    expect(parseQuantity('12')).toBe(12)
  })

  it('parses comma decimals as integers when integral', () => {
    expect(parseQuantity('12,0')).toBe(12)
  })

  it('rejects fractions, negatives and non-numeric values', () => {
    expect(parseQuantity(12.5)).toBeNull()
    expect(parseQuantity('-1')).toBeNull()
    expect(parseQuantity('abc')).toBeNull()
  })

  it('rejects empty and null values', () => {
    expect(parseQuantity(null)).toBeNull()
    expect(parseQuantity(undefined)).toBeNull()
    expect(parseQuantity('')).toBeNull()
  })
})

describe('buildImportRows', () => {
  it('maps valid rows with sku and quantity', () => {
    const { rows, errors } = buildImportRows(
      [{ sku: 'SKU-A', stock: 10 }, { sku: 'SKU-B', stock: '5' }],
      2
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ sku: 'SKU-A', quantity: 10 })
    expect(errors).toHaveLength(0)
  })

  it('collects errors for rows without sku or with invalid quantity', () => {
    const { rows, errors } = buildImportRows(
      [{ sku: '', stock: 10 }, { sku: 'SKU-B', stock: 'abc' }],
      2
    )
    expect(rows).toHaveLength(0)
    expect(errors).toHaveLength(2)
    expect(errors[0].row).toBe(2)
    expect(errors[1].sku).toBe('SKU-B')
  })

  it('uses the offset for row numbers', () => {
    const { errors } = buildImportRows([{ sku: '', stock: 10 }], 10)
    expect(errors[0].row).toBe(10)
  })

  it('trims surrounding whitespace from skus', () => {
    const { rows } = buildImportRows([{ sku: '  SKU-A  ', stock: 3 }], 2)
    expect(rows[0].sku).toBe('SKU-A')
  })
})
