import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { resolveConditionalMedia } from '@/lib/runtime/conditional-media'
import { createAdminClient } from '@/lib/supabase/admin'

function item(overrides: Record<string, unknown>) {
  return {
    id: overrides.id ?? `item-${Math.random().toString(36).slice(2, 8)}`,
    business_id: 'biz-1',
    image_url: 'https://abc123.supabase.co/storage/v1/object/public/knowledge-media/biz-1/img.jpg',
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
    update: vi.fn(),
    maybeSingle: vi.fn(),
    then: (
      onFulfilled: (v: { data: unknown; error: null }) => unknown,
      onRejected?: (e: unknown) => unknown
    ) => Promise.resolve({ data, error: null }).then(onFulfilled, onRejected),
  }
  thenable.select.mockReturnValue(thenable)
  thenable.eq.mockReturnValue(thenable)
  thenable.not.mockReturnValue(thenable)
  thenable.maybeSingle.mockReturnValue(thenable)
  thenable.insert.mockReturnValue(Promise.resolve({ data: null, error: null }))
  thenable.update.mockReturnValue(thenable)
  return thenable
}

function mockSupabase(
  candidates: unknown[],
  dispatched: unknown[] = [],
  sentProducts: string[] = []
) {
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'knowledge_items') return makeThenable(candidates)
      if (table === 'conversations') return makeThenable({ media_sent_products: sentProducts })
      return makeThenable(dispatched)
    }),
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

  it('does NOT fall back to generic media when productId is known but has no specific item', async () => {
    const neurofeet = item({ id: 'neurofeet-1', product_id: 'prod-neurofeet' })
    const generic = item({ id: 'generic-1', product_id: null })
    mockSupabase([neurofeet, generic])

    const result = await resolveConditionalMedia({ ...baseParams, productId: 'prod-clean-nails' })

    expect(result).toBeNull()
  })

  it('does NOT return a generic item with another product image when productId is known', async () => {
    const neurotinGeneric = item({
      id: 'neurotin-img',
      product_id: null,
      image_url: 'https://abc123.supabase.co/storage/v1/object/public/knowledge-media/biz-1/neurotin.jpg',
      trigger_condition: 'informacion',
    })
    mockSupabase([neurotinGeneric])

    const result = await resolveConditionalMedia({ ...baseParams, productId: 'prod-clean-nails' })

    expect(result).toBeNull()
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

describe('resolveConditionalMedia once-per-product/session', () => {
  it('omits the image when the product was already sent in this conversation', async () => {
    const productMedia = item({ id: 'media-1', product_id: 'prod-x' })
    mockSupabase([productMedia], [], ['prod-x'])

    const result = await resolveConditionalMedia({ ...baseParams, productId: 'prod-x' })

    expect(result).toBeNull()
  })

  it('sends and records the product the first time, then omits it on later turns', async () => {
    const productMedia = item({ id: 'media-1', product_id: 'prod-x' })
    const supabase = mockSupabase([productMedia], [], [])

    const first = await resolveConditionalMedia({ ...baseParams, productId: 'prod-x' })
    expect(first?.knowledgeItemId).toBe('media-1')

    const updateCall = supabase.from.mock.calls.find(([table]) => table === 'conversations')
    expect(updateCall).toBeDefined()

    // Segundo turno: el producto ya figura como enviado.
    mockSupabase([productMedia], [], ['prod-x'])
    const second = await resolveConditionalMedia({ ...baseParams, productId: 'prod-x' })
    expect(second).toBeNull()
  })

  it('does not serve generic media when productId is known, even if not yet sent', async () => {
    const generic = item({ id: 'generic-1', product_id: null })
    mockSupabase([generic], [], ['prod-x'])

    const result = await resolveConditionalMedia({ ...baseParams, productId: 'prod-x' })

    expect(result).toBeNull()
  })

  it('rejects a media URL that is not safe (relative path)', async () => {
    const bad = item({ id: 'bad-1', product_id: null, image_url: '/local/image.jpg' })
    mockSupabase([bad])

    const result = await resolveConditionalMedia({ ...baseParams, productId: null })

    expect(result).toBeNull()
  })

  it('rejects a media URL pointing to localhost', async () => {
    const bad = item({ id: 'bad-2', product_id: null, image_url: 'http://localhost:3000/img.jpg' })
    mockSupabase([bad])

    const result = await resolveConditionalMedia({ ...baseParams, productId: null })

    expect(result).toBeNull()
  })

  it('accepts a public Supabase Storage URL', async () => {
    const good = item({ id: 'good-1', product_id: null })
    mockSupabase([good])

    const result = await resolveConditionalMedia({ ...baseParams, productId: null })

    expect(result?.imageUrl).toBe(
      'https://abc123.supabase.co/storage/v1/object/public/knowledge-media/biz-1/img.jpg'
    )
  })
})

describe('resolveConditionalMedia resend request', () => {
  it('re-dispatches an already dispatched item when the customer asks again', async () => {
    const generic = item({ id: 'generic-1', product_id: null })
    mockSupabase([generic], [{ knowledge_item_id: 'generic-1' }])

    const result = await resolveConditionalMedia({ ...baseParams, productId: null, isResend: true })

    expect(result?.knowledgeItemId).toBe('generic-1')
  })

  it('re-dispatches a product image even when already sent in this conversation', async () => {
    const productMedia = item({ id: 'media-1', product_id: 'prod-x' })
    mockSupabase([productMedia], [], ['prod-x'])

    const result = await resolveConditionalMedia({ ...baseParams, productId: 'prod-x', isResend: true })

    expect(result?.knowledgeItemId).toBe('media-1')
  })

  it('still omits the image when isResend is false and everything was dispatched', async () => {
    const generic = item({ id: 'generic-1', product_id: null })
    mockSupabase([generic], [{ knowledge_item_id: 'generic-1' }])

    const result = await resolveConditionalMedia({ ...baseParams, productId: null, isResend: false })

    expect(result).toBeNull()
  })

  it('works without a customer id (laboratorio conversations)', async () => {
    const generic = item({ id: 'generic-1', product_id: null })
    let insertPayload: Record<string, unknown> | undefined
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'knowledge_items') return makeThenable([generic])
        const thenable = makeThenable([])
        if (table === 'chat_media_dispatched') {
          thenable.insert = vi.fn((payload: Record<string, unknown>) => {
            insertPayload = payload
            return Promise.resolve({ data: null, error: null })
          })
        }
        return thenable
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    const result = await resolveConditionalMedia({
      businessId: 'biz-1',
      conversationId: 'conv-1',
      userMessage: '¿cuál es el precio?',
      productId: null,
    })

    expect(result?.knowledgeItemId).toBe('generic-1')
    expect(insertPayload).toBeDefined()
    expect(insertPayload?.customer_id).toBeUndefined()
  })
})
