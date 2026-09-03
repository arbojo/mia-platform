import { describe, it, expect, vi, beforeEach } from 'vitest'

// LOOP 2.1 — SIMULATOR SALE_* ISOLATION (ratificado)
// requestType='simulation' NUNCA produce eventos comerciales reales.

vi.mock('@ai-sdk/openai', () => ({ openai: vi.fn(() => ({})) }))
vi.mock('ai', () => ({ streamText: vi.fn(), generateText: vi.fn() }))
vi.mock('@/lib/conversation/context', () => ({ loadConversationContext: vi.fn() }))
vi.mock('@/lib/ai/cost', () => ({ trackAiUsage: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/runtime/product-recommendation', () => ({ resolveRecommendedProduct: vi.fn() }))
vi.mock('@/lib/runtime/conditional-media', () => ({ resolveConditionalMedia: vi.fn() }))
vi.mock('@/lib/runtime/media', () => ({ isResendRequest: vi.fn(() => false) }))
vi.mock('@/lib/runtime/media-guard', () => ({ isSafeMediaUrl: vi.fn(() => true) }))
vi.mock('@/lib/runtime/evidence-extraction', () => ({ extractEvidenceFromCustomerMessage: vi.fn() }))
vi.mock('@/lib/channels/identity', () => ({ resolveCustomer: vi.fn() }))
vi.mock('@/lib/conversation/resolver', () => ({
  resolveConnection: vi.fn(),
  resolveConversation: vi.fn(),
}))
vi.mock('@/lib/sales/process', () => ({ processSaleClosing: vi.fn() }))

import { processCore } from '@/lib/runtime/core'
import { loadConversationContext } from '@/lib/conversation/context'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveRecommendedProduct } from '@/lib/runtime/product-recommendation'
import { resolveConditionalMedia } from '@/lib/runtime/conditional-media'
import { processSaleClosing } from '@/lib/sales/process'

const FAKE_UUIDS = {
  business: 'b1111111-1111-1111-1111-111111111111',
  assistant: 'a1111111-1111-1111-1111-111111111111',
  customer: 'c1111111-1111-1111-1111-111111111111',
  conversation: 'd1111111-1111-1111-1111-111111111111',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(loadConversationContext).mockResolvedValue({
    systemPrompt: 'Test prompt',
    usedContext: [{ type: 'test', id: 't1' }],
    fullAssistant: { id: FAKE_UUIDS.assistant },
    businessId: FAKE_UUIDS.business,
    assistantId: FAKE_UUIDS.assistant,
  } as never)
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    not: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    update: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: (resolve: (v: { data: unknown; error: null }) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
  }
  vi.mocked(createAdminClient).mockReturnValue({ from: vi.fn(() => chain) } as never)
  vi.mocked(resolveRecommendedProduct).mockResolvedValue(null)
  vi.mocked(resolveConditionalMedia).mockResolvedValue(null)
})

async function mockGenerate(text: string) {
  const ai = await import('ai')
  vi.mocked(ai.generateText).mockResolvedValue({
    text,
    usage: { promptTokens: 10, completionTokens: 5 },
  } as never)
}

async function mockStream(text: string) {
  const ai = await import('ai')
  vi.mocked(ai.streamText).mockImplementation(((config: {
    onFinish?: (params: { text: string; usage: { inputTokens: number; outputTokens: number } }) => Promise<void>
  }) => {
    setTimeout(async () => {
      if (config.onFinish) await config.onFinish({ text, usage: { inputTokens: 10, outputTokens: 5 } })
    }, 0)
    return {
      textStream: { [Symbol.asyncIterator]: async function* () { yield text } },
      toTextStreamResponse: vi.fn(() => new Response()),
    }
  }) as never)
}

const baseInput = (requestType: string, mode: 'complete' | 'stream', channel: 'simulation' | 'whatsapp' | 'widget') => ({
  businessId: FAKE_UUIDS.business,
  assistantId: FAKE_UUIDS.assistant,
  customerId: FAKE_UUIDS.customer,
  conversationId: FAKE_UUIDS.conversation,
  userMessage: 'Quiero comprar esto',
  channel,
  mode,
  requestType,
})

describe('SIMULATOR SALE_* ISOLATION (LOOP 2.1, ratificado)', () => {
  it('simulation + complete → NO ejecuta processSaleClosing (respuesta sigue produciéndose)', async () => {
    await mockGenerate('Respuesta de simulación con cierre detectado')
    const output = await processCore(baseInput('simulation', 'complete', 'simulation'))
    expect(output.response).toBe('Respuesta de simulación con cierre detectado')
    expect(processSaleClosing).not.toHaveBeenCalled()
  })

  it('live_customer + complete → closing real (SALE_* permitido)', async () => {
    await mockGenerate('Sale response')
    await processCore(baseInput('live_customer', 'complete', 'whatsapp'))
    expect(processSaleClosing).toHaveBeenCalledTimes(1)
  })

  it('simulation + stream → NO ejecuta processSaleClosing vía onFinish', async () => {
    await mockStream('Respuesta simulada')
    await processCore(baseInput('simulation', 'stream', 'simulation'))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(processSaleClosing).not.toHaveBeenCalled()
  })

  it('live_customer + stream → closing real vía onFinish', async () => {
    await mockStream('Sale response')
    await processCore(baseInput('live_customer', 'stream', 'widget'))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(processSaleClosing).toHaveBeenCalledTimes(1)
  })

  // ── LOOP 2.3 / Opción B (autorizado): training también queda aislado ─────────
  it('training + complete + simulation → NO ejecuta processSaleClosing (0 SALE_*)', async () => {
    await mockGenerate('Respuesta de training')
    await processCore(baseInput('training', 'complete', 'simulation'))
    expect(processSaleClosing).not.toHaveBeenCalled()
  })

  it('training + stream + simulation → NO ejecuta processSaleClosing (0 SALE_*)', async () => {
    await mockStream('Respuesta de training')
    await processCore(baseInput('training', 'stream', 'simulation'))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(processSaleClosing).not.toHaveBeenCalled()
  })

  // Anti-regresión: 'live_customer' sobre channel='simulation' (Web Chat cuyo
  // channel puede defaultar a 'simulation') DEBE seguir cerrando ventas.
  it('live_customer + complete + simulation → closing real preservado (Web Chat)', async () => {
    await mockGenerate('Sale response')
    await processCore(baseInput('live_customer', 'complete', 'simulation'))
    expect(processSaleClosing).toHaveBeenCalledTimes(1)
  })

  it('live_customer + complete + web → closing real preservado (Web Chat explícito)', async () => {
    await mockGenerate('Sale response')
    await processCore(baseInput('live_customer', 'complete', 'web'))
    expect(processSaleClosing).toHaveBeenCalledTimes(1)
  })
})
