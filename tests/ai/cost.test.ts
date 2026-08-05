import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ai/knowledge', () => ({
  recordAiUsage: vi.fn(),
}))

import { calculateCost, extractTokenUsage, trackAiUsage } from '@/lib/ai/cost'
import { recordAiUsage } from '@/lib/ai/knowledge'

const mockedRecordAiUsage = vi.mocked(recordAiUsage)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('calculateCost', () => {
  it('calcula costo con tokens de gpt-4o-mini', () => {
    // 1000 input * 0.00015/1K + 500 output * 0.0006/1K = 0.00015 + 0.00030
    expect(calculateCost(1000, 500)).toBeCloseTo(0.00045)
  })

  it('devuelve 0 cuando no hay tokens', () => {
    expect(calculateCost(0, 0)).toBe(0)
  })
})

describe('extractTokenUsage', () => {
  it('extrae promptTokens/completionTokens (formato Vercel)', () => {
    const usage = extractTokenUsage({ promptTokens: 100, completionTokens: 50 })
    expect(usage).toEqual({ promptTokens: 100, completionTokens: 50 })
  })

  it('extrae inputTokens/outputTokens (formato OpenAI)', () => {
    const usage = extractTokenUsage({ inputTokens: 200, outputTokens: 80 })
    expect(usage).toEqual({ promptTokens: 200, completionTokens: 80 })
  })

  it('devuelve 0 ante usage invalido', () => {
    expect(extractTokenUsage(null)).toEqual({ promptTokens: 0, completionTokens: 0 })
    expect(extractTokenUsage('nope')).toEqual({ promptTokens: 0, completionTokens: 0 })
  })
})

describe('trackAiUsage', () => {
  it('registra uso cuando hay tokens', async () => {
    mockedRecordAiUsage.mockResolvedValue(undefined)
    await trackAiUsage({
      business_id: 'b-1',
      assistant_id: 'a-1',
      promptTokens: 1000,
      completionTokens: 500,
      request_type: 'training',
    })

    expect(mockedRecordAiUsage).toHaveBeenCalledTimes(1)
    const [payload] = mockedRecordAiUsage.mock.calls[0]
    expect(payload.model).toBe('gpt-4o-mini')
    expect(payload.tokens_input).toBe(1000)
    expect(payload.tokens_output).toBe(500)
    expect(payload.cost).toBeCloseTo(0.00045)
    expect(payload.request_type).toBe('training')
  })

  it('no registra cuando no hay tokens', async () => {
    await trackAiUsage({
      business_id: 'b-1',
      assistant_id: 'a-1',
      promptTokens: 0,
      completionTokens: 0,
    })
    expect(mockedRecordAiUsage).not.toHaveBeenCalled()
  })

  it('no propaga errores de registro', async () => {
    mockedRecordAiUsage.mockRejectedValue(new Error('DB down'))
    await expect(
      trackAiUsage({
        business_id: 'b-1',
        assistant_id: 'a-1',
        promptTokens: 10,
        completionTokens: 5,
      })
    ).resolves.toBeUndefined()
  })
})
