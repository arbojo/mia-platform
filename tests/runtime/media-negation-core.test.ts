import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@ai-sdk/openai', () => ({ openai: vi.fn(() => ({})) }))
vi.mock('ai', () => ({ streamText: vi.fn(), generateText: vi.fn() }))
vi.mock('@/lib/conversation/context', () => ({ loadConversationContext: vi.fn() }))
vi.mock('@/lib/ai/cost', () => ({ trackAiUsage: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/runtime/product-recommendation', () => ({
  resolveRecommendedProduct: vi.fn(),
}))
vi.mock('@/lib/runtime/media', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/runtime/media')>()
  return { ...actual, isResendRequest: vi.fn(() => false) }
})
vi.mock('@/lib/runtime/media-guard', () => ({ isSafeMediaUrl: vi.fn(() => true) }))
vi.mock('@/lib/runtime/evidence-extraction', () => ({
  extractEvidenceFromCustomerMessage: vi.fn(),
}))
vi.mock('@/lib/sales/process', () => ({ processSaleClosing: vi.fn() }))
vi.mock('@/lib/runtime/context-media', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/runtime/context-media')>()
  const DISPATCHED = {
    attachment: {
      knowledgeItemId: '647db1fd-cf13-49bb-a854-9d78f6eef6e2',
      imageUrl:
        'https://hhitqgsaglddjkmaovbs.supabase.co/storage/v1/object/public/knowledge-media/4fb7418d-6c98-4a09-9094-4e4e4b2006a6/556f6b00-3304-4680-997c-dcf83bcae3bc.jpg',
      mediaType: 'image',
    },
    decision: {
      ...actual.emptyMediaDecision(),
      scope: ['96c33f39-0cf0-4b1b-994b-181acbef7c57'],
      explicitScope: 'Clean Nails',
      eligible: true,
      assetSelected: '647db1fd-cf13-49bb-a854-9d78f6eef6e2',
      claim: 'existing_hit',
      dispatched: 'unknown',
      delivered: 'unknown',
      mediaStatus: 'DISPATCHED',
      reason: 'existing_hit redispatched on explicit media request',
      selectedAsset: {
        productId: '96c33f39-0cf0-4b1b-994b-181acbef7c57',
        semanticDescription:
          'clean nails en forma fisica, muestra las ventajas "seguro e indoloro" "sin efectos secundarios"',
        mediaType: 'image',
      },
    },
  }
  return {
    ...actual,
    resolveContextMedia: vi.fn().mockResolvedValue(DISPATCHED),
  }
})

import { processCore } from '@/lib/runtime/core'
import { loadConversationContext } from '@/lib/conversation/context'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveRecommendedProduct } from '@/lib/runtime/product-recommendation'
import { resolveContextMedia, emptyMediaDecision } from '@/lib/runtime/context-media'
import { processSaleClosing } from '@/lib/sales/process'

const REAL_TEXT =
  'No tengo imágenes del Clean Nails en este momento. Pero puedo ofrecerte más información sobre su uso y beneficios. Si deseas saber más o hacer un pedido, ¡aquí estoy para ayudarte!'
const EXPECTED_REPAIRED =
  'Pero puedo ofrecerte más información sobre su uso y beneficios. Si deseas saber más o hacer un pedido, ¡aquí estoy para ayudarte!'

function makeMockSupabase() {
  const insertMock = vi.fn((_payload: Record<string, unknown>) =>
    Promise.resolve({ data: null, error: null })
  )
  const mockMaybeSingle = vi.fn(() =>
    Promise.resolve({ data: null, error: null } as { data: unknown; error: unknown })
  )
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    not: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    insert: insertMock,
    update: vi.fn(() => chain),
    maybeSingle: mockMaybeSingle,
    then: (resolve: (v: { data: unknown; error: null }) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
  }
  const fromMock = vi.fn(() => chain)
  const supabase = { from: fromMock }

  return { supabase, fromMock, insertMock, mockMaybeSingle }
}

const FAKE_UUIDS = {
  business: 'b1111111-1111-1111-1111-111111111111',
  assistant: 'a1111111-1111-1111-1111-111111111111',
  customer: 'c1111111-1111-1111-1111-111111111111',
  conversation: 'd1111111-1111-1111-1111-111111111111',
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.RETENTION_CORE_ENABLED = '0'
  vi.mocked(loadConversationContext).mockResolvedValue({
    systemPrompt: 'Test prompt',
    usedContext: [{ type: 'test', id: 't1' }],
    fullAssistant: { id: FAKE_UUIDS.assistant },
    businessId: FAKE_UUIDS.business,
    assistantId: FAKE_UUIDS.assistant,
  })
  vi.mocked(resolveRecommendedProduct).mockResolvedValue(null)
})

describe('media negation guard en processCore (complete)', () => {
  it('corrige la negación cuando media_status es DISPATCHED (caso real)', async () => {
    const { generateText } = await import('ai')
    vi.mocked(generateText).mockResolvedValue({
      text: REAL_TEXT,
      usage: { promptTokens: 10, completionTokens: 5 },
    } as never)

    const { supabase, insertMock } = makeMockSupabase()
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    const result = await processCore({
      businessId: FAKE_UUIDS.business,
      assistantId: FAKE_UUIDS.assistant,
      customerId: FAKE_UUIDS.customer,
      conversationId: FAKE_UUIDS.conversation,
      userMessage: 'tienes imagen?',
      channel: 'whatsapp',
      mode: 'complete',
      requestType: 'live_customer',
    })

    expect(result.response).toBe(EXPECTED_REPAIRED)
    expect(result.media).not.toBeNull()
    expect(result.metadata.mediaNegationGuard).toBe(true)

    const inserts = insertMock.mock.calls.map((c) => c[0] as Record<string, unknown>)
    const assistantInserts = inserts.filter((p) => p.role === 'assistant')
    const lastAssistant = assistantInserts[assistantInserts.length - 1]
    expect(lastAssistant?.content).toBe(EXPECTED_REPAIRED)
    expect((lastAssistant?.metadata as Record<string, unknown>)?.media_negation_guard).toEqual({
      corrected: true,
      matched: expect.any(Array),
    })

    const salesArgs = vi.mocked(processSaleClosing).mock.calls.map((c) => c[0])
    const lastSales = salesArgs[salesArgs.length - 1]
    const salesMessages = lastSales?.messages as Array<{ role: string; content: string }>
    expect(salesMessages.at(-1)?.content).toBe(EXPECTED_REPAIRED)
  })

  it('mantiene intacto un texto correcto cuando la imagen se despacha', async () => {
    const goodText = 'Claro, te reenvío la foto del Clean Nails, aquí la tienes.'
    const { generateText } = await import('ai')
    vi.mocked(generateText).mockResolvedValue({
      text: goodText,
      usage: { promptTokens: 10, completionTokens: 5 },
    } as never)

    const { supabase } = makeMockSupabase()
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    const result = await processCore({
      businessId: FAKE_UUIDS.business,
      assistantId: FAKE_UUIDS.assistant,
      customerId: FAKE_UUIDS.customer,
      conversationId: FAKE_UUIDS.conversation,
      userMessage: 'tienes imagen?',
      channel: 'whatsapp',
      mode: 'complete',
      requestType: 'live_customer',
    })

    expect(result.response).toBe(goodText)
    expect(result.metadata.mediaNegationGuard).toBeUndefined()
  })

  it('no toca el texto si no hubo dispatch (safeMedia null)', async () => {
    vi.mocked(resolveContextMedia).mockResolvedValue({
      attachment: null,
      decision: {
        ...emptyMediaDecision(),
        mediaStatus: 'NONE',
      },
    })

    const { generateText } = await import('ai')
    vi.mocked(generateText).mockResolvedValue({
      text: REAL_TEXT,
      usage: { promptTokens: 10, completionTokens: 5 },
    } as never)

    const { supabase } = makeMockSupabase()
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    const result = await processCore({
      businessId: FAKE_UUIDS.business,
      assistantId: FAKE_UUIDS.assistant,
      customerId: FAKE_UUIDS.customer,
      conversationId: FAKE_UUIDS.conversation,
      userMessage: 'tienes imagen?',
      channel: 'whatsapp',
      mode: 'complete',
      requestType: 'live_customer',
    })

    expect(result.response).toBe(REAL_TEXT)
    expect(result.media).toBeNull()
    expect(result.metadata.mediaNegationGuard).toBeUndefined()
  })
})