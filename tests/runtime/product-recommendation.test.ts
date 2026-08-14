import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { resolveRecommendedProduct } from '@/lib/runtime/product-recommendation'
import { createAdminClient } from '@/lib/supabase/admin'

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-1',
    business_id: 'biz-1',
    name: 'Clean Nails',
    sku: 'CN-001',
    price: 45,
    description: 'Tratamiento de uñas',
    benefits: 'Duradero, natural',
    faq: {},
    restrictions: null,
    image_url: 'https://example.com/clean-nails.jpg',
    documents: [],
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function knowledgeItem(overrides: Record<string, unknown>) {
  return {
    id: overrides.id ?? `item-${Math.random().toString(36).slice(2, 8)}`,
    business_id: 'biz-1',
    category: 'faq',
    question: '¿Qué productos ofrecen?',
    answer: 'Tenemos varios',
    source: 'manual',
    confidence: 'high',
    image_url: null,
    trigger_condition: 'precio',
    media_type: 'image',
    product_id: 'prod-1',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

interface QueryResult {
  data: unknown
  single?: unknown
}

function mockSupabase(tables: Record<string, QueryResult>) {
  const supabase = {
    from: vi.fn((table: string) => makeQuery(tables[table] ?? { data: [] })),
  }
  vi.mocked(createAdminClient).mockReturnValue(supabase as never)
  return supabase
}

function makeQuery(result: QueryResult) {
  let single = false
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    not: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(() => {
      single = true
      return chain
    }),
    then: (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve({ data: single ? (result.single ?? null) : result.data, error: null }).then(onFulfilled),
  }
  return chain
}

const baseParams = {
  businessId: 'biz-1',
  userMessage: '¿cuál es el precio?',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('resolveRecommendedProduct', () => {
  it('landing con productId resuelve el producto', async () => {
    mockSupabase({ products: { data: [], single: product() } })

    const result = await resolveRecommendedProduct({ ...baseParams, productId: 'prod-1' })

    expect(result).toEqual({
      productId: 'prod-1',
      name: 'Clean Nails',
      price: 45,
      imageUrl: 'https://example.com/clean-nails.jpg',
      description: 'Tratamiento de uñas',
      benefits: 'Duradero, natural',
    })
  })

  it('landing usa la imagen del producto y si falta cae al media del producto', async () => {
    mockSupabase({
      products: { data: [], single: product({ image_url: null }) },
      knowledge_items: { data: [], single: { image_url: 'https://example.com/media.jpg' } },
    })

    const result = await resolveRecommendedProduct({ ...baseParams, productId: 'prod-1' })

    expect(result?.imageUrl).toBe('https://example.com/media.jpg')
  })

  it('landing con producto inexistente devuelve null', async () => {
    mockSupabase({ products: { data: [], single: null } })

    const result = await resolveRecommendedProduct({ ...baseParams, productId: 'prod-desconocido' })

    expect(result).toBeNull()
  })

  it('trigger de knowledge_item por mensaje resuelve el producto asociado', async () => {
    mockSupabase({
      knowledge_items: { data: [knowledgeItem({ trigger_condition: 'uñas acrilicas' })] },
      products: { data: [], single: product() },
    })

    const result = await resolveRecommendedProduct({ ...baseParams, userMessage: '¿hacen uñas acrílicas?' })

    expect(result?.productId).toBe('prod-1')
  })

  it('trigger de knowledge_item por intentTag resuelve el producto asociado', async () => {
    mockSupabase({
      knowledge_items: { data: [knowledgeItem({ trigger_condition: 'intent:price' })] },
      products: { data: [], single: product() },
    })

    const result = await resolveRecommendedProduct({ ...baseParams, intentTag: 'price' })

    expect(result?.productId).toBe('prod-1')
  })

  it('ambigüedad entre productos distintos devuelve null', async () => {
    mockSupabase({
      knowledge_items: {
        data: [
          knowledgeItem({ id: 'item-1', trigger_condition: 'envio', product_id: 'prod-1' }),
          knowledgeItem({ id: 'item-2', trigger_condition: 'envio', product_id: 'prod-2' }),
        ],
      },
      products: { data: [], single: null },
    })

    const result = await resolveRecommendedProduct({ ...baseParams, userMessage: '¿hacen envíos?' })

    expect(result).toBeNull()
  })

  it('sin coincidencia devuelve null', async () => {
    mockSupabase({
      knowledge_items: { data: [knowledgeItem({ trigger_condition: 'otra cosa' })] },
      products: { data: [] },
    })

    const result = await resolveRecommendedProduct({ ...baseParams, userMessage: 'hola' })

    expect(result).toBeNull()
  })

  it('fallback de intención price con un solo producto activo lo resuelve', async () => {
    mockSupabase({
      knowledge_items: { data: [] },
      products: { data: [product()] },
    })

    const result = await resolveRecommendedProduct({ ...baseParams, userMessage: '¿cuánto cuesta?' })

    expect(result?.productId).toBe('prod-1')
  })

  it('fallback de intención catalog con varios productos es ambiguo y devuelve null', async () => {
    mockSupabase({
      knowledge_items: { data: [] },
      products: { data: [product(), product({ id: 'prod-2', name: 'Neurofeet' })] },
    })

    const result = await resolveRecommendedProduct({ ...baseParams, userMessage: '¿qué productos tienen?' })

    expect(result).toBeNull()
  })
})
