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
    order: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    maybeSingle: vi.fn(),
    upsert: vi.fn(),
    then: (
      onFulfilled: (v: { data: unknown; error: null }) => unknown,
      onRejected?: (e: unknown) => unknown
    ) => Promise.resolve({ data, error: null }).then(onFulfilled, onRejected),
  }
  thenable.select.mockReturnValue(thenable)
  thenable.eq.mockReturnValue(thenable)
  thenable.not.mockReturnValue(thenable)
  thenable.order.mockReturnValue(thenable)
  thenable.maybeSingle.mockReturnValue(thenable)
  thenable.insert.mockReturnValue(Promise.resolve({ data: null, error: null }))
  thenable.upsert.mockReturnValue({
    select: () => Promise.resolve({ data: [{ knowledge_item_id: 'claimed' }], error: null }),
  })
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
    let upsertPayload: Record<string, unknown> | undefined
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'knowledge_items') return makeThenable([generic])
        const thenable = makeThenable([])
        if (table === 'chat_media_dispatched') {
          thenable.upsert = vi.fn((payload: Record<string, unknown>) => {
            upsertPayload = payload
            return {
              select: () => Promise.resolve({ data: [{ knowledge_item_id: payload.knowledge_item_id }], error: null }),
            }
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
    expect(upsertPayload).toBeDefined()
    expect(upsertPayload?.customer_id).toBeUndefined()
  })
})

describe('resolveConditionalMedia concurrent dispatch uniqueness', () => {
  interface Harness {
    rows: Map<string, Record<string, unknown>>
    upserts: Array<{ payload: Record<string, unknown>; outcome: string }>
    conversationUpdates: number
  }

  /**
   * Fake que replica la semantica REAL de chat_media_dispatched:
   * uq_chat_media_once (migracion 016) + upsert ignoreDuplicates de PostgREST
   * (filas ignoradas no se retornan -> data vacia). La barrera sincroniza a
   * todos los lectores ANTES del primer reclamo, reproduciendo el interleaving
   * A:SELECT -> B:SELECT -> A:UPSERT -> B:UPSERT de forma determinista.
   */
  function concurrencyHarness(existingKeys: string[] = [], readers = 5): Harness {
    const rows = new Map<string, Record<string, unknown>>(
      existingKeys.map((key) => [key, { knowledge_item_id: key.split('::')[0] }])
    )
    const harness: Harness = { rows, upserts: [], conversationUpdates: 0 }

    let arrived = 0
    let openBarrier!: () => void
    const barrier = new Promise<void>((resolve) => {
      openBarrier = resolve
    })

    const knowledgeItem = {
      id: 'generic-1',
      business_id: 'biz-1',
      image_url:
        'https://abc123.supabase.co/storage/v1/object/public/knowledge-media/biz-1/img.jpg',
      trigger_condition: 'precio',
      media_type: 'image',
      product_id: null,
    }

    function readChain(table: string) {
      const t = {
        select: () => t,
        eq: () => t,
        not: () => t,
        order: () => t,
        update: () => {
          harness.conversationUpdates += 1
          return t
        },
        maybeSingle: () =>
          Promise.resolve({ data: { media_sent_products: [] }, error: null }),
        then: (onFulfilled: (v: { data: unknown; error: unknown }) => unknown) => {
          if (table !== 'chat_media_dispatched') {
            const data = table === 'knowledge_items' ? [knowledgeItem] : []
            return Promise.resolve({ data, error: null }).then(onFulfilled)
          }
          arrived += 1
          if (arrived >= readers) openBarrier()
          return barrier.then(() =>
            Promise.resolve({ data: [...rows.values()], error: null }).then(onFulfilled)
          )
        },
      }
      return t
    }

    const dispatched = {
      ...readChain('chat_media_dispatched'),
      upsert: (payload: Record<string, unknown>) => ({
        select: () => {
          const key = `${String(payload.knowledge_item_id)}::${String(payload.conversation_id)}`
          if (rows.has(key)) {
            harness.upserts.push({ payload, outcome: 'IGNORED' })
            return Promise.resolve({ data: [], error: null })
          }
          rows.set(key, payload)
          harness.upserts.push({ payload, outcome: 'CLAIMED' })
          return Promise.resolve({
            data: [{ knowledge_item_id: payload.knowledge_item_id }],
            error: null,
          })
        },
      }),
    }

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'chat_media_dispatched') return dispatched
        return readChain(table)
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)
    return harness
  }

  it('N concurrent normal dispatches: exactly one delivers, the rest degrade to null without throwing', async () => {
    const N = 5
    concurrencyHarness([], N)

    const settled = await Promise.allSettled(
      Array.from({ length: N }, () => resolveConditionalMedia({ ...baseParams, productId: null }))
    )

    const delivered = settled.filter(
      (s): s is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof resolveConditionalMedia>>>> =>
        s.status === 'fulfilled' && s.value !== null
    )
    const degraded = settled.filter(
      (s): s is PromiseFulfilledResult<Awaited<ReturnType<typeof resolveConditionalMedia>>> =>
        s.status === 'fulfilled' && s.value === null
    )
    const thrown = settled.filter((s) => s.status === 'rejected')

    expect(delivered).toHaveLength(1)
    expect(degraded).toHaveLength(N - 1)
    expect(thrown).toHaveLength(0)
  })

  it('a lost claim degrades to null WITHOUT throwing and does NOT mark the product as sent', async () => {
    // La pre-lectura pasa (vista vacia) pero el reclamo llega tarde:
    // otra ejecucion gano la fila y PostgREST devuelve data vacia.
    let conversationUpdates = 0
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'knowledge_items') {
          return makeThenable([item({ id: 'generic-1', product_id: null })])
        }
        if (table === 'chat_media_dispatched') {
          const thenable = makeThenable([])
          thenable.upsert = vi.fn(() => ({
            select: () => Promise.resolve({ data: [], error: null }),
          }))
          return thenable
        }
        const thenable = makeThenable([])
        thenable.update = vi.fn(() => {
          conversationUpdates += 1
          return thenable
        })
        return thenable
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    const result = await resolveConditionalMedia({ ...baseParams, productId: null })

    expect(result).toBeNull()
    expect(conversationUpdates).toBe(0)
  })

  it('intentional resend against an existing ledger row delivers WITHOUT duplicating the row', async () => {
    const harness = concurrencyHarness(['generic-1::conv-1'], 1)

    const first = await resolveConditionalMedia({ ...baseParams, productId: null, isResend: true })
    const second = await resolveConditionalMedia({ ...baseParams, productId: null, isResend: true })

    expect(first?.knowledgeItemId).toBe('generic-1')
    expect(second?.knowledgeItemId).toBe('generic-1')
    expect(harness.rows.size).toBe(1)
    expect(harness.conversationUpdates).toBe(0)
  })

  it('non-duplicate persistence failures remain observable (throw)', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'knowledge_items') {
          return makeThenable([item({ id: 'generic-1', product_id: null })])
        }
        const thenable = makeThenable([])
        if (table === 'chat_media_dispatched') {
          thenable.upsert = vi.fn(() => ({
            select: () =>
              Promise.resolve({
                data: null,
                error: { code: '42501', message: 'RLS violation', details: null, hint: null },
              }),
          }))
        }
        return thenable
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    await expect(
      resolveConditionalMedia({ ...baseParams, productId: null })
    ).rejects.toMatchObject({ code: '42501' })
  })

  it('non-product media records the dispatch and never touches media_sent_products', async () => {
    const harness = concurrencyHarness([], 1)

    const result = await resolveConditionalMedia({ ...baseParams, productId: null })

    expect(result?.knowledgeItemId).toBe('generic-1')
    expect(harness.upserts).toHaveLength(1)
    expect(harness.upserts[0]?.outcome).toBe('CLAIMED')
    expect(harness.conversationUpdates).toBe(0)
  })
})
