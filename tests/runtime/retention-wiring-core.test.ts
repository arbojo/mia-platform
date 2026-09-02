import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/sales/retention', () => ({ resolveRetentionDecision: vi.fn() }))
vi.mock('@/lib/sales/process', () => ({ processSaleClosing: vi.fn() }))
vi.mock('@/lib/runtime/execute-ai', () => ({ executeAI: vi.fn() }))
vi.mock('@/lib/conversation/context', () => ({ loadConversationContext: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/runtime/product-recommendation', () => ({ resolveRecommendedProduct: vi.fn() }))
vi.mock('@/lib/runtime/context-media', () => ({
  resolveContextMedia: vi.fn(),
  setMediaClaimState: vi.fn(),
  logMediaDecision: vi.fn(),
  emptyMediaDecision: vi.fn(() => ({
    scope: 'none',
    explicitScope: false,
    eligible: false,
    assetSelected: null,
    claim: 'none',
    dispatched: false,
    delivered: false,
  })),
}))
vi.mock('@/lib/runtime/context-scope', () => ({
  resolveScopeContext: vi.fn(async () => ({ messageScope: 'none', source: 'none', explicit: [] })),
}))
vi.mock('@/lib/runtime/media', () => ({ isResendRequest: vi.fn(() => false) }))
vi.mock('@/lib/runtime/media-guard', () => ({ isSafeMediaUrl: vi.fn(() => true) }))
vi.mock('@/lib/runtime/evidence-extraction', () => ({ extractEvidenceFromCustomerMessage: vi.fn() }))
vi.mock('@/lib/ai/prompts', () => ({ withMediaResolutionFeedback: vi.fn((p: string) => p) }))
vi.mock('@/lib/runtime/runtime', () => ({
  resolveCancellationGuards: vi.fn(),
  toChronologicalTranscript: (
    msgs: Array<{ role: string; content: string }>
  ): Array<{ role: 'user' | 'assistant'; content: string }> =>
    msgs.slice().reverse().map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
}))

import { processCore } from '@/lib/runtime/core'
import { resolveRetentionDecision } from '@/lib/sales/retention'
import { processSaleClosing } from '@/lib/sales/process'
import { executeAI } from '@/lib/runtime/execute-ai'
import { loadConversationContext } from '@/lib/conversation/context'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveRecommendedProduct } from '@/lib/runtime/product-recommendation'
import { extractEvidenceFromCustomerMessage } from '@/lib/runtime/evidence-extraction'
import { resolveCancellationGuards } from '@/lib/runtime/runtime'
import { resolveContextMedia, emptyMediaDecision } from '@/lib/runtime/context-media'

const mockedResolveRetentionDecision = vi.mocked(resolveRetentionDecision)
const mockedProcessSaleClosing = vi.mocked(processSaleClosing)
const mockedExecuteAI = vi.mocked(executeAI)
const mockedResolveCancellationGuards = vi.mocked(resolveCancellationGuards)

const UUID = {
  business: 'b1111111-1111-1111-1111-111111111111',
  assistant: 'a1111111-1111-1111-1111-111111111111',
  customer: 'c1111111-1111-1111-1111-111111111111',
  conversation: 'd1111111-1111-1111-1111-111111111111',
}

function makeMockSupabase() {
  const insertMock = vi.fn((_payload: Record<string, unknown>) => Promise.resolve({ data: null, error: null }))
  const mockMaybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }))
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    not: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    insert: insertMock,
    update: vi.fn(() => chain),
    updateJson: vi.fn(() => chain),
    maybeSingle: mockMaybeSingle,
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: (resolve: (v: { data: unknown; error: null }) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
  }
  const fromMock = vi.fn(() => chain)
  const supabase = { from: fromMock }
  return { supabase, fromMock, insertMock, mockMaybeSingle }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedResolveCancellationGuards.mockResolvedValue({
    cancellationContext: null,
    lastCancelledOrder: null,
    userIntent: null,
  })
  vi.mocked(createAdminClient).mockReturnValue(makeMockSupabase().supabase as never)
  vi.mocked(loadConversationContext).mockResolvedValue({
    systemPrompt: 'Eres un asistente.',
    usedContext: [{ type: 'test', id: 't1' }],
    fullAssistant: { id: UUID.assistant },
    businessId: UUID.business,
    assistantId: UUID.assistant,
  } as never)
  vi.mocked(resolveRecommendedProduct).mockResolvedValue(null)
  vi.mocked(resolveContextMedia).mockResolvedValue({
    attachment: null,
    decision: emptyMediaDecision(),
  } as never)
  vi.mocked(extractEvidenceFromCustomerMessage).mockResolvedValue([])
  vi.mocked(executeAI).mockResolvedValue({
    content: 'Respuesta normal del asistente',
    usage: { promptTokens: 1, completionTokens: 1 },
  } as never)
})

const CORE_INPUT = {
  businessId: UUID.business,
  assistantId: UUID.assistant,
  customerId: UUID.customer,
  conversationId: UUID.conversation,
  channel: 'web' as const,
  mode: 'complete' as const,
  requestType: 'live_customer',
}

describe('T1-3 wiring (Core) — A: none → flujo normal intacto', () => {
  it('none: ejecuta AI + processSaleClosing, sin metadata.retention', async () => {
    mockedResolveRetentionDecision.mockResolvedValue({ action: 'none' })

    const result = await processCore({ ...CORE_INPUT, userMessage: 'Hola' })

    expect(result.response).toBe('Respuesta normal del asistente')
    expect(result.metadata.retention).toBeUndefined()
    expect(mockedResolveRetentionDecision).toHaveBeenCalledTimes(1)
    expect(mockedExecuteAI).toHaveBeenCalledTimes(1)
    expect(mockedProcessSaleClosing).toHaveBeenCalledTimes(1)
  })

  it('none con conversationId opcional resuelve customerId desde la conversación', async () => {
    const { supabase, mockMaybeSingle } = makeMockSupabase()
    mockMaybeSingle.mockResolvedValue({ data: { customer_id: UUID.customer }, error: null } as never)
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)
    mockedResolveRetentionDecision.mockResolvedValue({ action: 'none' })

    const result = await processCore({
      businessId: UUID.business,
      assistantId: UUID.assistant,
      conversationId: UUID.conversation,
      channel: 'web' as const,
      mode: 'complete' as const,
      requestType: 'live_customer',
      userMessage: 'Hola',
    })

    expect(result.metadata.customerId).toBe(UUID.customer)
    expect(mockedExecuteAI).toHaveBeenCalledTimes(1)
  })
})

describe('T1-3 wiring (Core) — B: discount_offer sin cancelación real', () => {
  it('discount_offer: respuesta canónica, sin LLM, sin processSaleClosing, metadata.retention', async () => {
    const { supabase, insertMock } = makeMockSupabase()
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)
    mockedResolveRetentionDecision.mockResolvedValue({
      action: 'discount_offer',
      response: 'Entiendo tu preocupación, Ana. Puedo ofrecerte un *10% de descuento*. ¿Confirmamos tu compra?',
    })

    const result = await processCore({ ...CORE_INPUT, userMessage: 'quiero cancelar mi pedido' })

    expect(result.response).toContain('*10% de descuento*')
    expect(result.metadata.retention).toBe(true)
    expect(result.product).toBeNull()
    expect(result.media).toBeNull()
    expect(mockedResolveRetentionDecision).toHaveBeenCalledTimes(1)
    expect(mockedExecuteAI).not.toHaveBeenCalled()
    expect(mockedProcessSaleClosing).not.toHaveBeenCalled()

    const retentionInserts = insertMock.mock.calls.filter(([row]: [Record<string, unknown>]) => {
      const meta = row.metadata as { retention?: boolean }
      return row.role === 'assistant' && meta?.retention === true
    })
    expect(retentionInserts).toHaveLength(1)
    expect(retentionInserts[0][0]).toMatchObject({
      conversation_id: UUID.conversation,
      role: 'assistant',
      content: expect.stringContaining('*10% de descuento*'),
    })
  })

  it('stream mode: respuesta completa, textStream undefined, sin AI ni closing', async () => {
    mockedResolveRetentionDecision.mockResolvedValue({
      action: 'discount_offer',
      response: 'Oferta canónica para {customer_name}',
    })

    const result = await processCore({ ...CORE_INPUT, userMessage: 'cancelame el pedido', mode: 'stream' })

    expect(result.response).toBe('Oferta canónica para {customer_name}')
    expect(result.textStream).toBeUndefined()
    expect(result.metadata.retention).toBe(true)
    expect(mockedExecuteAI).not.toHaveBeenCalled()
    expect(mockedProcessSaleClosing).not.toHaveBeenCalled()
  })
})

describe('T1-3 wiring (Core) — D: confirm_cancel tras sentinel/rechazo', () => {
  it('confirm_cancel: reutiliza la respuesta del motor (primitiva de cancelación), sin LLM ni closing', async () => {
    mockedResolveRetentionDecision.mockResolvedValue({
      action: 'confirm_cancel',
      response: 'Tu solicitud de cancelación ha sido procesada.',
    })

    const result = await processCore({ ...CORE_INPUT, userMessage: 'no, quiero cancelar' })

    expect(result.response).toBe('Tu solicitud de cancelación ha sido procesada.')
    expect(result.metadata.retention).toBe(true)
    expect(mockedExecuteAI).not.toHaveBeenCalled()
    expect(mockedProcessSaleClosing).not.toHaveBeenCalled()
  })
})

describe('T1-3 wiring (Core) — E: ack (ya cancelado)', () => {
  it('ack: respuesta canónica, sin nueva venta/cancelación, sin LLM', async () => {
    mockedResolveRetentionDecision.mockResolvedValue({
      action: 'ack',
      response: 'Tu pedido ya fue cancelado anteriormente. ¿Hay algo más en lo que te pueda ayudar?',
    })

    const result = await processCore({ ...CORE_INPUT, userMessage: 'quiero cancelar' })

    expect(result.response).toContain('ya fue cancelado anteriormente')
    expect(result.metadata.retention).toBe(true)
    expect(mockedExecuteAI).not.toHaveBeenCalled()
    expect(mockedProcessSaleClosing).not.toHaveBeenCalled()
  })
})

describe('T1-3 wiring (Core) — F/G/H: una sola evaluación, sin LLM, sin eventos duplicados', () => {
  it('F: resolveRetentionDecision se ejecuta UNA sola vez por turno en rama none', async () => {
    mockedResolveRetentionDecision.mockResolvedValue({ action: 'none' })

    await processCore({ ...CORE_INPUT, userMessage: 'Hola' })

    expect(mockedResolveRetentionDecision).toHaveBeenCalledTimes(1)
  })

  it('F: resolveRetentionDecision se ejecuta UNA sola vez por turno en rama discount_offer', async () => {
    mockedResolveRetentionDecision.mockResolvedValue({ action: 'discount_offer', response: 'Oferta' })

    await processCore({ ...CORE_INPUT, userMessage: 'quiero cancelar' })

    expect(mockedResolveRetentionDecision).toHaveBeenCalledTimes(1)
  })

  it('G: el LLM NO se llama en discount_offer ni ack (cero tokens en turno de retención)', async () => {
    mockedResolveRetentionDecision.mockResolvedValueOnce({ action: 'discount_offer', response: 'Oferta' })
    mockedResolveRetentionDecision.mockResolvedValueOnce({ action: 'ack', response: 'Ya cancelado' })

    await processCore({ ...CORE_INPUT, userMessage: 'quiero cancelar' })
    await processCore({ ...CORE_INPUT, userMessage: 'cancelar' })

    expect(mockedExecuteAI).not.toHaveBeenCalled()
  })

  it('H: proceso de cierre ejecutado exactamente UNA vez en flujo normal y CERO en ramas de retención', async () => {
    mockedResolveRetentionDecision.mockResolvedValueOnce({ action: 'none' })
    mockedResolveRetentionDecision.mockResolvedValueOnce({ action: 'discount_offer', response: 'Oferta' })
    mockedResolveRetentionDecision.mockResolvedValueOnce({ action: 'confirm_cancel', response: 'Procesado' })
    mockedResolveRetentionDecision.mockResolvedValueOnce({ action: 'ack', response: 'Ya cancelado' })

    await processCore({ ...CORE_INPUT, userMessage: 'Hola' })
    await processCore({ ...CORE_INPUT, userMessage: 'quiero cancelar mi pedido' })
    await processCore({ ...CORE_INPUT, userMessage: 'no, quiero cancelar' })
    await processCore({ ...CORE_INPUT, userMessage: 'quiero cancelar' })

    expect(mockedProcessSaleClosing).toHaveBeenCalledTimes(1)
  })
})