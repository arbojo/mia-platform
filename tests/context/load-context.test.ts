import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/ai/knowledge', () => ({ getBusinessContext: vi.fn(), getRecentLessons: vi.fn() }))
vi.mock('@/lib/ai/prompts', () => ({ buildMasterPrompt: vi.fn() }))

import { loadConversationContext, clearContextCache, invalidateConversationContext, ContextError } from '@/lib/conversation/context'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBusinessContext, getRecentLessons } from '@/lib/ai/knowledge'
import { buildMasterPrompt } from '@/lib/ai/prompts'
import { FAKE_UUIDS, mockAssistant, mockBusiness, mockProducts, mockRules, mockInstructions, mockKnowledgeItems, mockLearningEvents } from '../fixtures'

function makeSupabase(singleResult: { data: unknown; error: unknown }) {
  const mockSingle = vi.fn().mockResolvedValue(singleResult)
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: mockSingle,
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn(() => chain),
    not: vi.fn(() => chain),
    contains: vi.fn(() => chain),
    is: vi.fn(() => chain),
    in: vi.fn(() => chain),
    textSearch: vi.fn(() => chain),
    filter: vi.fn(() => chain),
    or: vi.fn(() => chain),
    range: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    gt: vi.fn(() => chain),
    lt: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    ilike: vi.fn(() => chain),
    like: vi.fn(() => chain),
    returns: vi.fn(() => chain),
    abortSignal: vi.fn(() => chain),
    throwOnError: vi.fn(() => chain),
  }
  mockSingle.mockResolvedValue(singleResult)
  return { from: vi.fn(() => chain) } as never
}

beforeEach(() => {
  vi.clearAllMocks()
  clearContextCache()
  vi.mocked(buildMasterPrompt).mockReturnValue('Eres un asistente de prueba.')
  vi.mocked(getRecentLessons).mockResolvedValue(mockLearningEvents)
})

describe('loadConversationContext', () => {
  it('loads assistant with business data', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabase({ data: { ...mockAssistant, businesses: mockBusiness }, error: null })
    )
    vi.mocked(getBusinessContext).mockResolvedValue({
      brand: null,
      products: [],
      rules: [],
      instructions: [],
      knowledge: [],
      memory: [],
      salesConfig: null,
    })

    const result = await loadConversationContext(FAKE_UUIDS.business, FAKE_UUIDS.assistant)

    expect(result.fullAssistant).toBeDefined()
    expect(result.businessId).toBe(FAKE_UUIDS.business)
    expect(result.assistantId).toBe(FAKE_UUIDS.assistant)
  })

  it('loads products, rules, instructions, knowledge, and memory via getBusinessContext', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabase({ data: { ...mockAssistant, businesses: mockBusiness }, error: null })
    )
    vi.mocked(getBusinessContext).mockResolvedValue({
      brand: null,
      products: mockProducts,
      rules: mockRules,
      instructions: mockInstructions,
      knowledge: mockKnowledgeItems,
      memory: [],
      salesConfig: null,
    })

    await loadConversationContext(FAKE_UUIDS.business, FAKE_UUIDS.assistant)

    expect(getBusinessContext).toHaveBeenCalledWith(FAKE_UUIDS.business)
  })

  it('loads recent lessons via getRecentLessons', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabase({ data: { ...mockAssistant, businesses: mockBusiness }, error: null })
    )
    vi.mocked(getBusinessContext).mockResolvedValue({
      brand: null,
      products: [],
      rules: [],
      instructions: [],
      knowledge: [],
      memory: [],
      salesConfig: null,
    })

    await loadConversationContext(FAKE_UUIDS.business, FAKE_UUIDS.assistant)

    expect(getRecentLessons).toHaveBeenCalledWith(FAKE_UUIDS.assistant, 10)
  })

  it('generates systemPrompt via buildMasterPrompt', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabase({ data: { ...mockAssistant, businesses: mockBusiness }, error: null })
    )
    vi.mocked(getBusinessContext).mockResolvedValue({
      brand: null,
      products: mockProducts,
      rules: mockRules,
      instructions: mockInstructions,
      knowledge: mockKnowledgeItems,
      memory: [],
      salesConfig: null,
    })

    await loadConversationContext(FAKE_UUIDS.business, FAKE_UUIDS.assistant)

    expect(buildMasterPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        business: mockBusiness,
        assistant: mockAssistant,
        products: mockProducts,
        rules: mockRules,
      })
    )
  })

  it('returns usedContext listing all loaded entities', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabase({ data: { ...mockAssistant, businesses: mockBusiness }, error: null })
    )
    vi.mocked(getBusinessContext).mockResolvedValue({
      brand: null,
      products: mockProducts,
      rules: mockRules,
      instructions: mockInstructions,
      knowledge: mockKnowledgeItems,
      memory: [],
      salesConfig: null,
    })

    const result = await loadConversationContext(FAKE_UUIDS.business, FAKE_UUIDS.assistant)

    expect(result.usedContext.length).toBe(
      mockProducts.length + mockRules.length + mockInstructions.length + mockKnowledgeItems.length
    )
    expect(result.usedContext[0].type).toBe('product')
    expect(result.usedContext[0].id).toBe(mockProducts[0].id)
  })

  it('throws ContextError when assistant does not exist', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabase({ data: null, error: null })
    )

    await expect(
      loadConversationContext(FAKE_UUIDS.business, 'nonexistent-id')
    ).rejects.toThrow(ContextError)
  })

  it('throws ContextError with code ASSISTANT_NOT_FOUND', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabase({ data: null, error: null })
    )

    const err = (await loadConversationContext(FAKE_UUIDS.business, 'nonexistent-id').catch(
      (e: unknown) => e
    )) as ContextError
    expect(err.code).toBe('ASSISTANT_NOT_FOUND')
    expect(err.statusCode).toBe(404)
  })

  describe('context cache', () => {
    beforeEach(() => {
      vi.mocked(createAdminClient).mockReturnValue(
        makeSupabase({ data: { ...mockAssistant, businesses: mockBusiness }, error: null })
      )
      vi.mocked(getBusinessContext).mockResolvedValue({
        brand: null,
        products: [],
        rules: [],
        instructions: [],
        knowledge: [],
        memory: [],
        salesConfig: null,
      })
    })

    it('first call queries Supabase', async () => {
      await loadConversationContext(FAKE_UUIDS.business, FAKE_UUIDS.assistant)

      expect(createAdminClient).toHaveBeenCalled()
      expect(getBusinessContext).toHaveBeenCalled()
      expect(getRecentLessons).toHaveBeenCalled()
    })

    it('second call uses cache without querying Supabase', async () => {
      await loadConversationContext(FAKE_UUIDS.business, FAKE_UUIDS.assistant)

      vi.mocked(createAdminClient).mockClear()
      vi.mocked(getBusinessContext).mockClear()
      vi.mocked(getRecentLessons).mockClear()

      await loadConversationContext(FAKE_UUIDS.business, FAKE_UUIDS.assistant)

      expect(createAdminClient).not.toHaveBeenCalled()
      expect(getBusinessContext).not.toHaveBeenCalled()
      expect(getRecentLessons).not.toHaveBeenCalled()
    })

    it('returns same data from cache on repeated calls', async () => {
      const result1 = await loadConversationContext(FAKE_UUIDS.business, FAKE_UUIDS.assistant)

      vi.mocked(buildMasterPrompt).mockReturnValue('Prompt modificado')
      vi.mocked(getBusinessContext).mockResolvedValue({
        brand: null,
        products: [mockProducts[0]],
        rules: [],
        instructions: [],
        knowledge: [],
        memory: [],
        salesConfig: null,
      })

      const result2 = await loadConversationContext(FAKE_UUIDS.business, FAKE_UUIDS.assistant)

      expect(result1.systemPrompt).toBe(result2.systemPrompt)
      expect(result1.usedContext).toEqual(result2.usedContext)
    })

    it('queries Supabase again after explicit cache clear', async () => {
      await loadConversationContext(FAKE_UUIDS.business, FAKE_UUIDS.assistant)

      vi.mocked(createAdminClient).mockClear()
      vi.mocked(getBusinessContext).mockClear()

      clearContextCache()

      await loadConversationContext(FAKE_UUIDS.business, FAKE_UUIDS.assistant)

      expect(createAdminClient).toHaveBeenCalled()
      expect(getBusinessContext).toHaveBeenCalled()
    })

    it('invalidates only the cache for the given business', async () => {
      await loadConversationContext(FAKE_UUIDS.business, FAKE_UUIDS.assistant)

      vi.mocked(createAdminClient).mockClear()
      vi.mocked(getBusinessContext).mockClear()

      invalidateConversationContext('other-business')

      await loadConversationContext(FAKE_UUIDS.business, FAKE_UUIDS.assistant)

      expect(createAdminClient).not.toHaveBeenCalled()
      expect(getBusinessContext).not.toHaveBeenCalled()

      invalidateConversationContext(FAKE_UUIDS.business)

      await loadConversationContext(FAKE_UUIDS.business, FAKE_UUIDS.assistant)

      expect(createAdminClient).toHaveBeenCalled()
      expect(getBusinessContext).toHaveBeenCalled()
    })

    it('queries Supabase again after TTL expires', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-07-29T12:00:00Z'))

      await loadConversationContext(FAKE_UUIDS.business, FAKE_UUIDS.assistant)

      vi.mocked(createAdminClient).mockClear()

      vi.advanceTimersByTime(5 * 60 * 1000 + 1)

      await loadConversationContext(FAKE_UUIDS.business, FAKE_UUIDS.assistant)

      expect(createAdminClient).toHaveBeenCalled()

      vi.useRealTimers()
    })
  })
})
