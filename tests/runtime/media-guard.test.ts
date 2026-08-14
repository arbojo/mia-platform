import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import {
  isSafeMediaUrl,
  getConversationMediaSentProducts,
  addConversationMediaSentProduct,
} from '@/lib/runtime/media-guard'

const SUPABASE_URL = 'https://abc123.supabase.co/storage/v1/object/public/knowledge-media/biz-1/img.jpg'

describe('isSafeMediaUrl', () => {
  it('accepts a public Supabase Storage URL', () => {
    expect(isSafeMediaUrl(SUPABASE_URL)).toBe(true)
  })

  it('accepts https under *.supabase.co', () => {
    expect(isSafeMediaUrl('https://project-ref.supabase.co/storage/v1/object/public/x/a.jpg')).toBe(true)
  })

  it('accepts an allowlisted public CDN', () => {
    expect(isSafeMediaUrl('https://cdn.jsdelivr.net/gh/user/repo@main/a.jpg')).toBe(true)
  })

  it('rejects relative paths', () => {
    expect(isSafeMediaUrl('/local/image.jpg')).toBe(false)
    expect(isSafeMediaUrl('knowledge-media/img.jpg')).toBe(false)
  })

  it('rejects non-http(s) protocols', () => {
    expect(isSafeMediaUrl('ftp://example.com/img.jpg')).toBe(false)
    expect(isSafeMediaUrl('file:///etc/passwd')).toBe(false)
  })

  it('rejects localhost and .local hosts', () => {
    expect(isSafeMediaUrl('http://localhost:3000/img.jpg')).toBe(false)
    expect(isSafeMediaUrl('https://bridge.local/img.jpg')).toBe(false)
  })

  it('rejects private and link-local IP literals', () => {
    expect(isSafeMediaUrl('https://10.0.0.1/img.jpg')).toBe(false)
    expect(isSafeMediaUrl('https://192.168.1.10/img.jpg')).toBe(false)
    expect(isSafeMediaUrl('https://172.16.5.5/img.jpg')).toBe(false)
    expect(isSafeMediaUrl('https://169.254.169.254/latest/meta-data/')).toBe(false)
    expect(isSafeMediaUrl('https://127.0.0.1/img.jpg')).toBe(false)
  })

  it('rejects credentials in the URL', () => {
    expect(isSafeMediaUrl('https://user:pass@abc123.supabase.co/img.jpg')).toBe(false)
  })

  it('rejects non-allowlisted hosts', () => {
    expect(isSafeMediaUrl('https://example.com/img.jpg')).toBe(false)
  })

  it('rejects empty and oversized values', () => {
    expect(isSafeMediaUrl('')).toBe(false)
    expect(isSafeMediaUrl('https://abc123.supabase.co/' + 'a'.repeat(2100))).toBe(false)
  })
})

function mockConversations(data: unknown) {
  const thenable = {
    select: vi.fn(),
    eq: vi.fn(),
    update: vi.fn(),
    maybeSingle: vi.fn(),
    then: (
      onFulfilled: (v: { data: unknown; error: null }) => unknown,
      onRejected?: (e: unknown) => unknown
    ) => Promise.resolve({ data, error: null }).then(onFulfilled, onRejected),
  }
  thenable.select.mockReturnValue(thenable)
  thenable.eq.mockReturnValue(thenable)
  thenable.maybeSingle.mockReturnValue(thenable)
  thenable.update.mockReturnValue(thenable)
  return thenable
}

function mockSupabase(conversationData: unknown) {
  const supabase = {
    from: vi.fn((_table: string) => mockConversations(conversationData)),
  }
  return supabase as never
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getConversationMediaSentProducts', () => {
  it('returns the products already sent for the conversation', async () => {
    const supabase = mockSupabase({ media_sent_products: ['prod-a', 'prod-b'] })
    const result = await getConversationMediaSentProducts(supabase, 'conv-1')
    expect(result).toEqual(['prod-a', 'prod-b'])
  })

  it('returns an empty array when the conversation has none', async () => {
    const supabase = mockSupabase({ media_sent_products: null })
    const result = await getConversationMediaSentProducts(supabase, 'conv-1')
    expect(result).toEqual([])
  })
})

describe('addConversationMediaSentProduct', () => {
  it('appends the product and persists the merged array', async () => {
    const supabase = mockSupabase({ media_sent_products: ['prod-a'] })
    await addConversationMediaSentProduct(supabase, 'conv-1', 'prod-b')

    const fromMock = (supabase as unknown as { from: ReturnType<typeof vi.fn> }).from
    const updateChain = fromMock.mock.results
      .map((r) => r.value as { update: ReturnType<typeof vi.fn> })
      .filter((v) => v && typeof v.update === 'function')
      .find((v) => v.update.mock.calls.length > 0)
    expect(updateChain).toBeDefined()
    expect(updateChain!.update).toHaveBeenCalledWith({
      media_sent_products: ['prod-a', 'prod-b'],
    })
  })

  it('does not duplicate an already-sent product', async () => {
    const supabase = mockSupabase({ media_sent_products: ['prod-a'] })
    await addConversationMediaSentProduct(supabase, 'conv-1', 'prod-a')

    const fromMock = (supabase as unknown as { from: ReturnType<typeof vi.fn> }).from
    const chains = fromMock.mock.results
      .map((r) => r.value as { update: ReturnType<typeof vi.fn> })
      .filter((v) => v && typeof v.update === 'function')
    const anyUpdate = chains.some((c) => c.update.mock.calls.length > 0)
    expect(anyUpdate).toBe(false)
  })
})
