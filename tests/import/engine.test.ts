import { describe, it, expect } from 'vitest'
import { upsertRows, MAX_IMPORT_ROWS, TooManyRowsError } from '@/lib/import/engine'
import { emptySummary } from '@/lib/import/types'
import type { NormalizedRow } from '@/lib/import/types'
import { createAdminMock } from './mock-admin'

function makeInput(rows: NormalizedRow[], overrides: Partial<Parameters<typeof upsertRows>[0]> = {}) {
  const { admin } = createAdminMock()
  return {
    rows,
    rowBase: 2,
    stockColumnPresent: false,
    businessId: 'business-1',
    admin,
    ...overrides,
  }
}

const ROW_A: NormalizedRow = {
  name: 'Perfume',
  sku: 'PER-1',
  price: 45,
  description: null,
  benefits: null,
  imageUrl: null,
}
const ROW_B: NormalizedRow = {
  name: 'Crema',
  sku: 'CRE-2',
  price: 18.5,
  description: null,
  benefits: null,
  imageUrl: null,
}

describe('upsertRows', () => {
  it('devuelve resumen vacío sin filas', async () => {
    const { admin } = createAdminMock()
    const summary = await upsertRows({
      rows: [],
      rowBase: 2,
      stockColumnPresent: false,
      businessId: 'business-1',
      admin,
    })
    expect(summary.created).toBe(0)
    expect(summary.updated).toBe(0)
    expect(summary.total).toBe(0)
  })

  it('rechaza más de 500 filas', async () => {
    const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i): NormalizedRow => ({
      ...ROW_A,
      sku: `SKU-${i}`,
      name: `Producto ${i}`,
    }))
    await expect(upsertRows(makeInput(rows))).rejects.toThrow(TooManyRowsError)
  })

  it('crea productos nuevos cuando el SKU no existe', async () => {
    const { admin, calls } = createAdminMock({ existing: [] })
    const summary = await upsertRows({
      rows: [ROW_A],
      rowBase: 2,
      stockColumnPresent: false,
      businessId: 'business-1',
      admin,
    })
    expect(summary.created).toBe(1)
    expect(summary.updated).toBe(0)
    const insertCall = calls.find((c) => c.method === 'insert')
    expect(insertCall).toBeDefined()
    const payload = insertCall?.args[0] as Record<string, unknown>
    expect(payload.business_id).toBe('business-1')
    expect(payload.name).toBe('Perfume')
    expect(payload.sku).toBe('PER-1')
  })

  it('actualiza productos existentes por SKU (case-insensitive)', async () => {
    const { admin, calls } = createAdminMock({ existing: [{ id: 'p1', sku: 'per-1' }] })
    const summary = await upsertRows({
      rows: [ROW_A],
      rowBase: 2,
      stockColumnPresent: false,
      businessId: 'business-1',
      admin,
    })
    expect(summary.updated).toBe(1)
    expect(summary.created).toBe(0)
    const updateCall = calls.find((c) => c.method === 'update')
    expect(updateCall).toBeDefined()
    const idFilter = calls.find((c) => c.method === 'eq' && c.args[0] === 'id')
    expect(idFilter?.args[1]).toBe('p1')
  })

  it('omite SKUs duplicados dentro del mismo origen', async () => {
    const { admin } = createAdminMock({ existing: [] })
    const summary = await upsertRows({
      rows: [ROW_A, { ...ROW_A }, ROW_B],
      rowBase: 2,
      stockColumnPresent: false,
      businessId: 'business-1',
      admin,
    })
    expect(summary.created).toBe(2)
    expect(summary.skipped).toBe(1)
    expect(summary.errors[0].message).toContain('duplicado')
  })

  it('preserva el resumen inicial y calcula total correcto', async () => {
    const { admin } = createAdminMock({ existing: [] })
    const initial = emptySummary()
    initial.skipped = 1
    initial.stockDropped = 3
    initial.stockColumnPresent = true
    initial.total = 2
    const summary = await upsertRows({
      rows: [ROW_A, ROW_B],
      rowBase: 2,
      stockColumnPresent: true,
      businessId: 'business-1',
      admin,
      initialSummary: initial,
    })
    expect(summary.created).toBe(2)
    expect(summary.skipped).toBe(1)
    expect(summary.stockDropped).toBe(3)
    expect(summary.stockColumnPresent).toBe(true)
    expect(summary.total).toBe(3)
  })

  it('cuenta errores de actualización como fallidos', async () => {
    const { admin } = createAdminMock({
      existing: [{ id: 'p1', sku: 'PER-1' }],
      updateError: new Error('boom'),
    })
    const summary = await upsertRows({
      rows: [ROW_A],
      rowBase: 2,
      stockColumnPresent: false,
      businessId: 'business-1',
      admin,
    })
    expect(summary.updated).toBe(0)
    expect(summary.errors).toHaveLength(1)
    expect(summary.errors[0].message).toContain('boom')
    expect(summary.total).toBe(1)
  })
})
