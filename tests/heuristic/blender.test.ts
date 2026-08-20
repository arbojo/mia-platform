import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { getBlendedPatterns } from '@/lib/heuristic/blender'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ExperienceMemoryItem } from '@/lib/heuristic/types'

function memory(overrides: Partial<ExperienceMemoryItem> = {}): ExperienceMemoryItem {
  return {
    id: 'mem-1',
    business_id: null,
    scope: 'global',
    industry: null,
    pattern_key: 'precio-alto',
    customer_objection: 'El precio es muy alto',
    sample_raw_query: '¿No tienen algo más barato?',
    suggested_response: 'Entiendo su preocupación. Nuestro producto tiene garantía de por vida.',
    conversion_probability: 0.80,
    confidence_level: 0.75,
    observation_count: 150,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeQuery(data: ExperienceMemoryItem[]) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    then: (resolve: (val: { data: ExperienceMemoryItem[] }) => void) =>
      resolve({ data }),
  }
}

describe('getBlendedPatterns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mezcla 70/30 correctamente cuando ambos scopes existen', async () => {
    const globalItem = memory({
      scope: 'global',
      pattern_key: 'precio-alto',
      conversion_probability: 0.80,
      suggested_response: 'Respuesta global',
    })
    const bizItem = memory({
      id: 'mem-2',
      business_id: 'biz-1',
      scope: 'business',
      pattern_key: 'precio-alto',
      conversion_probability: 0.60,
      suggested_response: 'Respuesta del negocio',
    })

    let callCount = 0
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => {
        callCount++
        if (callCount === 1) return makeQuery([globalItem])
        return makeQuery([bizItem])
      }),
    } as never)

    const result = await getBlendedPatterns('biz-1', 'salud_suplementos')

    expect(result).toHaveLength(1)
    expect(result[0].patternKey).toBe('precio-alto')
    expect(result[0].blendedProbability).toBeCloseTo(0.80 * 0.70 + 0.60 * 0.30, 3)
    expect(result[0].finalResponse).toBe('Respuesta del negocio')
  })

  it('usa solo probabilidad del negocio cuando no existe base global/industria', async () => {
    const bizItem = memory({
      business_id: 'biz-1',
      scope: 'business',
      pattern_key: 'envio-lento',
      conversion_probability: 0.90,
      suggested_response: 'Respuesta negocio exclusiva',
    })

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => makeQuery([bizItem])),
    } as never)

    const result = await getBlendedPatterns('biz-1', 'inmobiliaria')

    expect(result).toHaveLength(1)
    expect(result[0].blendedProbability).toBeCloseTo(0.90, 3)
    expect(result[0].finalResponse).toBe('Respuesta negocio exclusiva')
  })

  it('usa solo probabilidad de la base cuando no existe patrón del negocio (cold-start)', async () => {
    const globalItem = memory({
      scope: 'global',
      pattern_key: 'duda-calidad',
      conversion_probability: 0.75,
      suggested_response: 'Respuesta base',
    })

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => makeQuery([globalItem])),
    } as never)

    const result = await getBlendedPatterns('biz-nuevo', 'inmobiliaria')

    expect(result).toHaveLength(1)
    expect(result[0].blendedProbability).toBeCloseTo(0.75, 3)
    expect(result[0].finalResponse).toBe('Respuesta base')
  })

  it('retorna array vacío cuando no hay patrones', async () => {
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => makeQuery([])),
    } as never)

    const result = await getBlendedPatterns('biz-1', 'inmobiliaria')

    expect(result).toHaveLength(0)
  })

  it('respeta ratio configurable', async () => {
    const globalItem = memory({
      scope: 'global',
      pattern_key: 'test',
      conversion_probability: 1.0,
    })
    const bizItem = memory({
      id: 'mem-2',
      business_id: 'biz-1',
      scope: 'business',
      pattern_key: 'test',
      conversion_probability: 0.0,
    })

    let callCount = 0
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => {
        callCount++
        if (callCount === 1) return makeQuery([globalItem])
        return makeQuery([bizItem])
      }),
    } as never)

    const result = await getBlendedPatterns('biz-1', 'test', 0.50)

    expect(result[0].blendedProbability).toBeCloseTo(0.50, 3)
  })

  it('prioriza respuesta del negocio sobre la base', async () => {
    const globalItem = memory({
      scope: 'global',
      pattern_key: 'obj-comun',
      suggested_response: 'Respuesta genérica',
    })
    const bizItem = memory({
      id: 'mem-2',
      business_id: 'biz-1',
      scope: 'business',
      pattern_key: 'obj-comun',
      suggested_response: 'Mi marca dice esto',
    })

    let callCount = 0
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => {
        callCount++
        if (callCount === 1) return makeQuery([globalItem])
        return makeQuery([bizItem])
      }),
    } as never)

    const result = await getBlendedPatterns('biz-1', 'salud')

    expect(result[0].finalResponse).toBe('Mi marca dice esto')
  })
})
