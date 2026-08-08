import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { resolveConditionalMedia } from '@/lib/runtime/conditional-media'
import { createAdminClient } from '@/lib/supabase/admin'

function item(overrides: Record<string, unknown>) {
  return {
    id: overrides.id ?? `item-${Math.random().toString(36).slice(2, 8)}`,
    business_id: 'biz-1',
    image_url: 'https://example.com/img.jpg',
    trigger_condition: 'precio',
    media_type: 'image',
    product_id: null,
    ...overrides,
  }
}

function makeThenable(data: unknown) {
  const thenable = {
    select: vi.fn(),
    eq: vi.fn(),
    not: vi.fn(),
    insert: vi.fn(),
    then: (
      onFulfilled: (v: { data: unknown; error: null }) => unknown,
      onRejected?: (e: unknown) => unknown
    ) => Promise.resolve({ data, error: null }).then(onFulfilled, onRejected),
  }
  thenable.select.mockReturnValue(thenable)
  thenable.eq.mockReturnValue(thenable)
  thenable.not.mockReturnValue(thenable)
  thenable.insert.mockReturnValue(Promise.resolve({ data: null, error: null }))
  return thenable
}

function mockSupabase(candidates: unknown[], dispatched: unknown[] = []) {
  const supabase = {
    from: vi.fn((table: string) =>
      table === 'knowledge_items' ? makeThenable(candidates) : makeThenable(dispatched)
    ),
  }
  vi.mocked(createAdminClient).mockReturnValue(supabase as never)
  return supabase
}

const baseParams = {
  businessId: 'biz-1',
  customerId: 'cust-1',
  conversationId: 'conv-1',
  userMessage: '¿cuál es el precio?',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('resolveConditionalMedia product scoping', () => {
  it('prefers the active product media over generic when productId matches', async () => {
    const generic = item({ id: 'generic-1', product_id: null })
    const cleanNails = item({ id: 'clean-nails-1', product_id: 'prod-clean-nails' })
    const neurofeet = item({ id: 'neurofeet-1', product_id: 'prod-neurofeet' })
    mockSupabase([generic, cleanNails, neurofeet])

    const result = await resolveConditionalMedia({ ...baseParams, productId: 'prod-clean-nails' })

    expect(result?.knowledgeItemId).toBe('clean-nails-1')
  })

  it('falls back to generic media when productId matches no specific item', async () => {
    const neurofeet = item({ id: 'neurofeet-1', product_id: 'prod-neurofeet' })
    const generic = item({ id: 'generic-1', product_id: null })
    mockSupabase([neurofeet, generic])

    const result = await resolveConditionalMedia({ ...baseParams, productId: 'prod-clean-nails' })

    expect(result?.knowledgeItemId).toBe('generic-1')
  })

  it('uses generic media when no product context is present', async () => {
    const specific = item({ id: 'specific-1', product_id: 'prod-x' })
    const generic = item({ id: 'generic-1', product_id: null })
    mockSupabase([specific, generic])

    const result = await resolveConditionalMedia({ ...baseParams, productId: null })

    expect(result?.knowledgeItemId).toBe('generic-1')
  })

  it('skips already dispatched media and records the dispatched item', async () => {
    const generic = item({ id: 'generic-1', product_id: null })
    const cleanNails = item({ id: 'clean-nails-1', product_id: 'prod-clean-nails' })
    mockSupabase([generic, cleanNails], [{ knowledge_item_id: 'generic-1' }])

    const result = await resolveConditionalMedia({ ...baseParams, productId: 'prod-clean-nails' })

    expect(result?.knowledgeItemId).toBe('clean-nails-1')

    const supabase = vi.mocked(createAdminClient).mock.results[0].value as {
      from: ReturnType<typeof vi.fn>
    }
    const insertCall = supabase.from.mock.calls.find(([table]) => table === 'chat_media_dispatched')
    expect(insertCall).toBeDefined()
  })

  it('returns null when no candidate matches the trigger', async () => {
    mockSupabase([item({ trigger_condition: 'aspecto fisico' })])

    const result = await resolveConditionalMedia({ ...baseParams, productId: null })

    expect(result).toBeNull()
  })

  it('returns null when every candidate has already been dispatched', async () => {
    const generic = item({ id: 'generic-1', product_id: null })
    mockSupabase([generic], [{ knowledge_item_id: 'generic-1' }])

    const result = await resolveConditionalMedia({ ...baseParams, productId: null })

    expect(result).toBeNull()
  })

  it('returns null without a conversation', async () => {
    const result = await resolveConditionalMedia({ ...baseParams, conversationId: null, productId: null })
    expect(result).toBeNull()
  })
})
