import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ai/client', () => ({ getOpenAIClient: vi.fn(), MODEL: 'gpt-4o-mini' }))
vi.mock('@/lib/ai/cost', () => ({ trackAiUsage: vi.fn() }))

import { hasSalesTrigger, detectSaleOutcome } from '@/lib/sales/detect'
import { getOpenAIClient } from '@/lib/ai/client'
import { trackAiUsage } from '@/lib/ai/cost'

const mockCreate = vi.fn()
vi.mocked(getOpenAIClient).mockReturnValue({
  chat: { completions: { create: mockCreate } },
} as unknown as ReturnType<typeof getOpenAIClient>)

describe('hasSalesTrigger', () => {
  it('detects purchase confirmation phrases', () => {
    expect(hasSalesTrigger('Sí, quiero confirmar el pedido')).toBe(true)
    expect(hasSalesTrigger('me llevo el combo')).toBe(true)
  })

  it('detects price and payment questions', () => {
    expect(hasSalesTrigger('¿cuánto cuesta?')).toBe(true)
    expect(hasSalesTrigger('¿se puede pagar con tarjeta?')).toBe(true)
  })

  it('detects rejection phrases', () => {
    expect(hasSalesTrigger('no me interesa, gracias')).toBe(true)
    expect(hasSalesTrigger('mejor no, está caro')).toBe(true)
  })

  it('detects contact data sharing', () => {
    expect(hasSalesTrigger('mi teléfono es 5491100000000')).toBe(true)
    expect(hasSalesTrigger('te paso mi celular')).toBe(true)
    expect(hasSalesTrigger('vivo en Mendoza')).toBe(true)
  })

  it('returns false for neutral messages', () => {
    expect(hasSalesTrigger('hola, ¿cómo estás?')).toBe(false)
    expect(hasSalesTrigger('gracias, chau')).toBe(false)
  })

  it('is case insensitive', () => {
    expect(hasSalesTrigger('QUIERO CONFIRMAR')).toBe(true)
  })
})

describe('detectSaleOutcome', () => {
  const params = {
    businessId: 'biz-1',
    assistantId: 'assistant-1',
    messages: [
      { role: 'user', content: 'hola' },
      { role: 'assistant', content: 'hola, ¿en qué te ayudo?' },
      { role: 'user', content: 'sí, confirmo el pedido' },
    ],
  }

  beforeEach(() => {
    mockCreate.mockReset()
    vi.mocked(trackAiUsage).mockReset()
  })

  it('parses a sold outcome with SALE_WON', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              outcome: 'sold',
              events: [{ type: 'SALE_WON', productName: 'Combo 1', amount: 120 }],
              customerName: 'Juan',
              address: 'Av. Siempre Viva 123',
            }),
          },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    })

    const result = await detectSaleOutcome(params)
    expect(result.outcome).toBe('sold')
    expect(result.events).toEqual([
      { type: 'SALE_WON', productName: 'Combo 1', amount: 120 },
    ])
    expect(result.customerName).toBe('Juan')
    expect(result.address).toBe('Av. Siempre Viva 123')
    expect(trackAiUsage).toHaveBeenCalledWith({
      business_id: 'biz-1',
      assistant_id: 'assistant-1',
      promptTokens: 100,
      completionTokens: 50,
      request_type: 'live_customer',
    })
  })

  it('returns null outcome and no events on invalid JSON', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'no pude analizar' } }],
      usage: null,
    })
    const result = await detectSaleOutcome(params)
    expect(result.outcome).toBeNull()
    expect(result.events).toEqual([])
  })

  it('parses phone, city and products with sanitization', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              outcome: 'sold',
              events: [{ type: 'SALE_WON', productName: 'Combo 1', amount: 120 }],
              customerName: 'Ana',
              phone: '+54 9 11 5555-1234',
              city: '  Buenos Aires ',
              address: 'Calle 1',
              products: [
                { name: 'Combo 1', amount: 120 },
                { name: 'Shampoo', amount: null },
                { name: '', amount: 50 },
              ],
            }),
          },
        },
      ],
      usage: null,
    })

    const result = await detectSaleOutcome(params)
    expect(result.phone).toBe('+5491155551234')
    expect(result.city).toBe('Buenos Aires')
    expect(result.products).toEqual([
      { name: 'Combo 1', amount: 120 },
      { name: 'Shampoo', amount: undefined },
    ])
  })

  it('rejects phone values too short to be valid', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              outcome: 'interested',
              events: [],
              phone: '123',
            }),
          },
        },
      ],
      usage: null,
    })
    const result = await detectSaleOutcome(params)
    expect(result.phone).toBeUndefined()
  })

  it('rejects invalid event types', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              outcome: 'interested',
              events: [{ type: 'NOT_A_REAL_TYPE', productName: 'X' }],
            }),
          },
        },
      ],
      usage: null,
    })
    const result = await detectSaleOutcome(params)
    expect(result.outcome).toBe('interested')
    expect(result.events).toEqual([])
  })

  it('rejects invalid outcome values', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        { message: { content: JSON.stringify({ outcome: 'maybe', events: [] }) } },
      ],
      usage: null,
    })
    const result = await detectSaleOutcome(params)
    expect(result.outcome).toBeNull()
  })
})
