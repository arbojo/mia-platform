import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { upsertRows, MAX_IMPORT_ROWS, TooManyRowsError } from '@/lib/import/engine'
import { emptySummary } from '@/lib/import/types'
import type { NormalizedRow } from '@/lib/import/types'
import { createAdminMock } from './mock-admin'

type RecordedCall = { method: string; args: unknown[] }

function createAdminWithInsertResult() {
  const calls: RecordedCall[] = []
  const wrapper: Record<string, unknown> = { data: null, error: null }
  let pending: 'fetch' | 'insert' | 'upsert' = 'fetch'
  wrapper.then = (onFulfilled: (value: unknown) => unknown) => {
    const result =
      pending === 'insert'
        ? { data: { id: 'prod-new-1', name: 'Perfume', sku: 'PER-1', price: 45, business_id: 'business-1' }, error: null }
        : pending === 'upsert'
          ? { data: null, error: null }
          : { data: [], error: null }
    pending = 'fetch'
    return Promise.resolve(result).then(onFulfilled)
  }
  for (const method of ['select', 'eq', 'order', 'limit', 'single', 'maybeSingle']) {
    wrapper[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return wrapper
    }
  }
  wrapper.insert = (...args: unknown[]) => {
    pending = 'insert'
    calls.push({ method: 'insert', args })
    return wrapper
  }
  wrapper.upsert = (...args: unknown[]) => {
    pending = 'upsert'
    calls.push({ method: 'upsert', args })
    return wrapper
  }
  const admin = { from: vi.fn(() => wrapper) } as unknown as SupabaseClient
  return { admin, calls }
}

function createAdminWithoutInsertId() {
  const wrapper: Record<string, unknown> = { data: null, error: null }
  let pending: 'fetch' | 'insert' = 'fetch'
  wrapper.then = (onFulfilled: (value: unknown) => unknown) => {
    const result =
      pending === 'insert'
        ? { data: null, error: null }
        : { data: [], error: null }
    pending = 'fetch'
    return Promise.resolve(result).then(onFulfilled)
  }
  for (const method of ['select', 'eq', 'order', 'limit', 'single', 'maybeSingle']) {
    wrapper[method] = (..._args: unknown[]) => wrapper
  }
  wrapper.insert = (..._args: unknown[]) => {
    pending = 'insert'
    return wrapper
  }
  const admin = { from: vi.fn(() => wrapper) } as unknown as SupabaseClient
  return { admin }
}

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

  it('asigna el id del producto nuevo al knowledge_item (INV-MEDIA-001/008)', async () => {
    const { admin, calls } = createAdminWithInsertResult()
    const summary = await upsertRows({
      rows: [ROW_A],
      rowBase: 2,
      stockColumnPresent: false,
      businessId: 'business-1',
      admin,
    })
    expect(summary.created).toBe(1)
    expect(summary.errors).toHaveLength(0)
    expect(summary.total).toBe(1)
    const upsertCall = calls.find((c) => c.method === 'upsert')
    expect(upsertCall).toBeDefined()
    const payload = upsertCall!.args[0] as {
      product_id: string
      trigger_condition: string | null
      business_id: string
    }
    expect(payload.product_id).toBe('prod-new-1')
    expect(payload.trigger_condition).toBeNull()
    expect(payload.business_id).toBe('business-1')
  })

  it('falla si el insert de producto no devuelve id', async () => {
    const { admin } = createAdminWithoutInsertId()
    const summary = await upsertRows({
      rows: [ROW_A],
      rowBase: 2,
      stockColumnPresent: false,
      businessId: 'business-1',
      admin,
    })
    expect(summary.created).toBe(0)
    expect(summary.total).toBe(1)
    expect(summary.errors[0].message).toContain('no devolvió el id')
  })
})
