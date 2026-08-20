import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { generateIndustrySuggestions } from '@/lib/heuristic/suggester'
import { createAdminClient } from '@/lib/supabase/admin'

interface QueryResult {
  data: unknown
  error?: unknown
}

function makeQuery(result: QueryResult) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnValue(result),
    single: vi.fn().mockReturnValue(result),
    then: (resolve: (val: QueryResult) => void) => resolve(result),
  }
  return chain
}

describe('generateIndustrySuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('crea sugerencias para patrones industriales de alto rendimiento', async () => {
    const industryPatterns = [
      { id: 'ind-1', pattern_key: 'precio-alto' },
      { id: 'ind-2', pattern_key: 'envio-lento' },
    ]

    const callCount = { current: 0 }
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'experience_memory') {
          callCount.current++
          if (callCount.current === 1) {
            return makeQuery({ data: industryPatterns })
          }
          return makeQuery({ data: [] })
        }
        if (table === 'experience_suggestions') {
          return makeQuery({ data: [], error: null })
        }
        return makeQuery({ data: [], error: null })
      }),
    } as never)

    const result = await generateIndustrySuggestions('biz-1', 'salud_suplementos')

    expect(result.suggestionsCreated).toBe(2)
  })

  it('no crea sugerencias cuando el negocio ya tiene el patrón', async () => {
    const industryPatterns = [
      { id: 'ind-1', pattern_key: 'precio-alto' },
    ]

    const callCount = { current: 0 }
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'experience_memory') {
          callCount.current++
          if (callCount.current === 1) {
            return makeQuery({ data: industryPatterns })
          }
          return makeQuery({ data: [{ pattern_key: 'precio-alto' }] })
        }
        if (table === 'experience_suggestions') {
          return makeQuery({ data: [], error: null })
        }
        return makeQuery({ data: [], error: null })
      }),
    } as never)

    const result = await generateIndustrySuggestions('biz-1', 'salud_suplementos')

    expect(result.suggestionsCreated).toBe(0)
  })

  it('no crea sugerencias cuando ya existe una sugerencia pendiente', async () => {
    const industryPatterns = [
      { id: 'ind-1', pattern_key: 'precio-alto' },
    ]

    const callCount = { current: 0 }
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'experience_memory') {
          callCount.current++
          if (callCount.current === 1) {
            return makeQuery({ data: industryPatterns })
          }
          return makeQuery({ data: [] })
        }
        if (table === 'experience_suggestions') {
          return makeQuery({ data: [{ parent_memory_id: 'ind-1' }], error: null })
        }
        return makeQuery({ data: [], error: null })
      }),
    } as never)

    const result = await generateIndustrySuggestions('biz-1', 'salud_suplementos')

    expect(result.suggestionsCreated).toBe(0)
  })

  it('retorna 0 cuando no hay patrones industriales', async () => {
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => makeQuery({ data: [] })),
    } as never)

    const result = await generateIndustrySuggestions('biz-1', 'inmobiliaria')

    expect(result.suggestionsCreated).toBe(0)
  })

  it('filtra solo patrones con conversion_probability > 0.70', async () => {
    const callCount = { current: 0 }
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'experience_memory') {
          callCount.current++
          if (callCount.current === 1) {
            return makeQuery({ data: [{ id: 'ind-1', pattern_key: 'bajo-rendimiento' }] })
          }
          return makeQuery({ data: [] })
        }
        if (table === 'experience_suggestions') {
          return makeQuery({ data: [], error: null })
        }
        return makeQuery({ data: [], error: null })
      }),
    } as never)

    const result = await generateIndustrySuggestions('biz-1', 'salud_suplementos')

    expect(result.suggestionsCreated).toBe(1)
  })
})
