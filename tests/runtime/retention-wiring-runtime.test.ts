import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/channels/identity', () => ({ resolveCustomer: vi.fn() }))
vi.mock('@/lib/conversation/context', () => ({ loadConversationContext: vi.fn() }))
vi.mock('@/lib/runtime/execute-ai', () => ({ executeAI: vi.fn() }))
vi.mock('@/lib/conversation/resolver', () => ({
  resolveConnection: vi.fn(),
  resolveConversation: vi.fn(),
}))
vi.mock('@/lib/runtime/intents', () => ({
  detectIntent: vi.fn(() => null),
  buildInteractiveForIntent: vi.fn(() => null),
}))
vi.mock('@/lib/sales/process', () => ({
  processSaleClosing: vi.fn(),
  isDiscountOfferSentinel: vi.fn(() => false),
}))
vi.mock('@/lib/sales/intent-classifier', () => ({
  classifyUserIntent: vi.fn(() => null),
}))
vi.mock('@/lib/runtime/conditional-media', () => ({
  resolveConditionalMedia: vi.fn(() => null),
}))
vi.mock('@/lib/runtime/media', () => ({
  isResendRequest: vi.fn(() => false),
}))
vi.mock('@/lib/runtime/media-guard', () => ({
  isSafeMediaUrl: vi.fn(() => true),
}))
vi.mock('@/lib/runtime/product-recommendation', () => ({
  resolveRecommendedProduct: vi.fn(() => null),
}))
vi.mock('@/lib/runtime/evidence-extraction', () => ({
  extractEvidenceFromCustomerMessage: vi.fn(),
}))
vi.mock('@/lib/runtime/core', () => ({ processCore: vi.fn() }))

import { processIncomingMessage, processStreaming } from '@/lib/runtime/runtime'
import { resolveCustomer } from '@/lib/channels/identity'
import { loadConversationContext } from '@/lib/conversation/context'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveConnection, resolveConversation } from '@/lib/conversation/resolver'
import { processCore } from '@/lib/runtime/core'
import { processSaleClosing } from '@/lib/sales/process'
import { FAKE_UUIDS, mockWireMessage, mockMessages } from '../fixtures'

const mockedProcessCore = vi.mocked(processCore)
const mockedProcessSaleClosing = vi.mocked(processSaleClosing)
const mockedResolveCustomer = vi.mocked(resolveCustomer)

function makeSupabaseMock() {
  const mockInsert = vi.fn((_row: Record<string, unknown>) => chain)
  const mockSelect = vi.fn(() => chain)
  const mockEq = vi.fn(() => chain)
  const mockOrder = vi.fn(() => chain)
  const mockLimit = vi.fn(() => chain)
  const mockNot = vi.fn(() => chain)
  const mockUpdate = vi.fn(() => chain)
  const mockMaybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }))
  const mockSingle = vi.fn(() => Promise.resolve({ data: null, error: null }))
  const mockContains = vi.fn(() => chain)

  const chain = {
    insert: mockInsert,
    select: mockSelect,
    eq: mockEq,
    order: mockOrder,
    limit: mockLimit,
    not: mockNot,
    update: mockUpdate,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    contains: mockContains,
  }

  const fromMock = vi.fn(() => chain)
  const supabase = { from: fromMock }

  return { supabase, fromMock, mockInsert, chain }
}

function retentionCoreOutput() {
  return {
    response: 'Entiendo tu preocupación, Ana. Puedo ofrecerte un *10% de descuento*. ¿Confirmamos tu compra?',
    product: null,
    media: null,
    metadata: {
      usedContext: [],
      conversationId: FAKE_UUIDS.conversation,
      customerId: FAKE_UUIDS.customer,
      deliver: true,
      retention: true,
    },
  } as never
}

function normalCoreOutput() {
  return {
    response: 'Respuesta normal',
    product: null,
    media: null,
    metadata: {
      usedContext: [],
      conversationId: FAKE_UUIDS.conversation,
      customerId: FAKE_UUIDS.customer,
      deliver: true,
    },
  } as never
}

beforeEach(() => {
  vi.clearAllMocks()

  vi.mocked(resolveConnection).mockResolvedValue({
    business_id: FAKE_UUIDS.business,
    assistant_id: FAKE_UUIDS.assistant,
    mode: 'active',
  })
  vi.mocked(resolveConversation).mockResolvedValue(FAKE_UUIDS.conversation)
  vi.mocked(loadConversationContext).mockResolvedValue({
    systemPrompt: 'Eres un asistente.',
    usedContext: [],
    fullAssistant: { id: FAKE_UUIDS.assistant },
    businessId: FAKE_UUIDS.business,
    assistantId: FAKE_UUIDS.assistant,
  })
  vi.mocked(resolveCustomer).mockResolvedValue({
    id: FAKE_UUIDS.customer,
    businessId: FAKE_UUIDS.business,
    name: 'Ana',
    phone: null,
    email: null,
    isNew: false,
  })
})

describe('T1-3 wiring (RUNTIME) — C: el safety-net de processSaleClosing NO ejecuta cancelación en un turno discount_offer', () => {
  it('complete + active con rama de retención → processSaleClosing NO se ejecuta', async () => {
    const { supabase, mockInsert } = makeSupabaseMock()
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)
    mockedProcessCore.mockResolvedValue(retentionCoreOutput())

    const result = await processIncomingMessage('web', mockWireMessage, {} as never)

    expect(result.response).toContain('*10% de descuento*')
    expect(mockedProcessSaleClosing).not.toHaveBeenCalled()
    expect(mockedResolveCustomer).toHaveBeenCalledTimes(1)

    const outgoingChannelInserts = mockInsert.mock.calls.filter(
      ([row]: [Record<string, unknown>]) => row.direction === 'outgoing'
    )
    expect(outgoingChannelInserts).toHaveLength(1)
  })

  it('complete + active sin rama de retención → el wrapper NO ejecuta processSaleClosing (Core es el único owner)', async () => {
    const { supabase } = makeSupabaseMock()
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)
    mockedProcessCore.mockResolvedValue(normalCoreOutput())

    await processIncomingMessage('web', mockWireMessage, {} as never)

    // Closing idempotency (LOOP 2): el Core ejecuta processSaleClosing una sola
    // vez (core.test.ts cubre esa ejecución). El wrapper de canal NO debe
    // añadir una segunda ejecución.
    expect(mockedProcessSaleClosing).not.toHaveBeenCalled()
  })

  it('complete + active + whatsapp: turno de retención NO construye interactive', async () => {
    vi.mocked(processCore).mockResolvedValue(retentionCoreOutput())
    const { supabase } = makeSupabaseMock()
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    await processIncomingMessage('whatsapp', mockWireMessage, {} as never)

    expect(mockedProcessSaleClosing).not.toHaveBeenCalled()
  })
})

describe('T1-3 wiring (RUNTIME) — stream: la rama de retención entrega UN único evento', () => {
  it('toTextStreamResponse entrega la respuesta canónica como texto plano', async () => {
    mockedProcessCore.mockResolvedValue(retentionCoreOutput())

    const result = await processStreaming({
      assistantId: FAKE_UUIDS.assistant,
      businessId: FAKE_UUIDS.business,
      messages: mockMessages,
      requestType: 'training',
      channel: 'simulation',
    })

    const text = await result.toTextStreamResponse().text()
    expect(text).toContain('*10% de descuento*')
  })

  it('toStructuredStreamResponse emite la respuesta en un único data y cierra con [DONE] (sin producto/media)', async () => {
    mockedProcessCore.mockResolvedValue(retentionCoreOutput())

    const result = await processStreaming({
      assistantId: FAKE_UUIDS.assistant,
      businessId: FAKE_UUIDS.business,
      messages: mockMessages,
      requestType: 'training',
      channel: 'simulation',
    })

    const body = await result.toStructuredStreamResponse().text()
    expect(body).toContain('*10% de descuento*')
    expect(body).toContain('[DONE]')
    expect(body).toContain('"text-delta"')
    expect(body).not.toContain('"product"')
    expect(body).not.toContain('"media"')
  })

  it('flujo sin retención: utiliza el textStream del Core (no la respuesta completa)', async () => {
    const stream = (async function* () {
      yield 'hola'
    })()
    mockedProcessCore.mockResolvedValue({
      response: '',
      textStream: stream,
      product: null,
      media: null,
      metadata: { usedContext: [], deliver: true },
    } as never)

    const result = await processStreaming({
      assistantId: FAKE_UUIDS.assistant,
      businessId: FAKE_UUIDS.business,
      messages: mockMessages,
      requestType: 'training',
      channel: 'simulation',
    })

    const text = await result.toTextStreamResponse().text()
    expect(text).toBe('hola')
  })
})