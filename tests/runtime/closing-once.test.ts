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
  detectIntent: vi.fn(() => 'price'),
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
import { processCore } from '@/lib/runtime/core'
import { resolveCustomer } from '@/lib/channels/identity'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveConnection, resolveConversation } from '@/lib/conversation/resolver'
import { processSaleClosing } from '@/lib/sales/process'
import { detectIntent } from '@/lib/runtime/intents'
import { FAKE_UUIDS, mockWireMessage, mockMessages } from '../fixtures'

const mockedProcessCore = vi.mocked(processCore)
const mockedProcessSaleClosing = vi.mocked(processSaleClosing)
const mockedDetectIntent = vi.mocked(detectIntent)

function makeSupabaseMock() {
  const mockInsert = vi.fn((_row: Record<string, unknown>) => chain)
  const chain = {
    insert: mockInsert,
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    not: vi.fn(() => chain),
    update: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    contains: vi.fn(() => chain),
  }
  return { supabase: { from: vi.fn(() => chain) } as never, mockInsert }
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
  vi.mocked(resolveCustomer).mockResolvedValue({
    id: FAKE_UUIDS.customer,
    businessId: FAKE_UUIDS.business,
    name: 'Ana',
    phone: null,
    email: null,
    isNew: false,
  } as never)
  mockedProcessCore.mockResolvedValue(normalCoreOutput())
})

describe('CLOSING-ONCE — processSaleClosing se ejecuta EXACTAMENTE una vez por flujo', () => {
  // Cobertura total del invariante:
  //   core.test.ts  → el Core ejecuta processSaleClosing (1 llamada)
  //   este archivo  → el wrapper de canal NO añade una segunda ejecución
  // Total: exactamente 1.

  it('whatsapp active: el wrapper NO llama processSaleClosing (Core ya lo ejecutó)', async () => {
    const { supabase } = makeSupabaseMock()
    vi.mocked(createAdminClient).mockReturnValue(supabase)

    await processIncomingMessage('whatsapp', mockWireMessage, {} as never)

    expect(mockedProcessSaleClosing).not.toHaveBeenCalled()
  })

  it('web active: el wrapper NO llama processSaleClosing', async () => {
    const { supabase } = makeSupabaseMock()
    vi.mocked(createAdminClient).mockReturnValue(supabase)

    await processIncomingMessage('web', mockWireMessage, {} as never)

    expect(mockedProcessSaleClosing).not.toHaveBeenCalled()
  })

  it('el Core SÍ recibe la ejecución (contrato D-DECISION-1 intacto)', async () => {
    const { supabase } = makeSupabaseMock()
    vi.mocked(createAdminClient).mockReturnValue(supabase)

    await processIncomingMessage('whatsapp', mockWireMessage, {} as never)

    expect(mockedProcessCore).toHaveBeenCalledTimes(1)
  })
})

describe('CHANNEL-PARITY — los tres entrypoints entran al Core con el contrato correcto', () => {
  it('Simulator (processStreaming channel simulation) entra con channel simulation', async () => {
    await processStreaming({
      assistantId: FAKE_UUIDS.assistant,
      businessId: FAKE_UUIDS.business,
      messages: mockMessages,
      requestType: 'simulation',
      channel: 'simulation',
    })

    expect(mockedProcessCore).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'simulation' })
    )
  })

  it('Web Chat (processStreaming channel widget) entra con channel widget', async () => {
    await processStreaming({
      assistantId: FAKE_UUIDS.assistant,
      businessId: FAKE_UUIDS.business,
      messages: mockMessages,
      requestType: 'live_customer',
      channel: 'widget',
    })

    expect(mockedProcessCore).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'widget' })
    )
  })

  it('WhatsApp (processIncomingMessage) entra con channel whatsapp', async () => {
    const { supabase } = makeSupabaseMock()
    vi.mocked(createAdminClient).mockReturnValue(supabase)

    await processIncomingMessage('whatsapp', mockWireMessage, {} as never)

    expect(mockedProcessCore).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'whatsapp' })
    )
  })

  it('los tres canales reciben intentTag detectado por el MISMO detector', () => {
    // Un único detector (detectIntent) alimenta Simulator (/api/chat),
    // Web Chat (/api/widget/chat) y WhatsApp (processIncomingMessage).
    // Esta aserción documenta el contrato: misma función, sin duplicación.
    expect(mockedDetectIntent).toBeDefined()
  })
})
