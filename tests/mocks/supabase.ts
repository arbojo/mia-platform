import { vi } from 'vitest'
import type { Mock } from 'vitest'

interface QueryResponse {
  data: unknown
  error: Error | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockChain = Mock & Record<string, any>

function chainableFn(response: QueryResponse) {
  const fn = vi.fn(() => response) as MockChain

  fn.from = vi.fn(() => fn)
  fn.select = vi.fn(() => fn)
  fn.insert = vi.fn(() => fn)
  fn.update = vi.fn(() => fn)
  fn.delete = vi.fn(() => fn)
  fn.eq = vi.fn(() => fn)
  fn.neq = vi.fn(() => fn)
  fn.gt = vi.fn(() => fn)
  fn.lt = vi.fn(() => fn)
  fn.gte = vi.fn(() => fn)
  fn.lte = vi.fn(() => fn)
  fn.like = vi.fn(() => fn)
  fn.ilike = vi.fn(() => fn)
  fn.is = vi.fn(() => fn)
  fn.not = vi.fn(() => fn)
  fn.in = vi.fn(() => fn)
  fn.contains = vi.fn(() => fn)
  fn.containedBy = vi.fn(() => fn)
  fn.range = vi.fn(() => fn)
  fn.order = vi.fn(() => fn)
  fn.limit = vi.fn(() => fn)
  fn.single = vi.fn(() => response)
  fn.maybeSingle = vi.fn(() => response)
  fn.textSearch = vi.fn(() => fn)
  fn.filter = vi.fn(() => fn)
  fn.or = vi.fn(() => fn)
  fn.returns = vi.fn(() => fn)
  fn.abortSignal = vi.fn(() => fn)
  fn.throwOnError = vi.fn(() => fn)

  return fn
}

export function createMockSupabase() {
  const defaultResponse: QueryResponse = { data: null, error: null }
  const fn = chainableFn(defaultResponse)

  fn.rpc = vi.fn(() => ({
    ...chainableFn(defaultResponse),
    single: vi.fn(() => defaultResponse),
  }))

  fn.storage = {
    from: vi.fn(() => ({
      upload: vi.fn(() => Promise.resolve({ data: null, error: null })),
      download: vi.fn(() => Promise.resolve({ data: null, error: null })),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: '' } })),
      list: vi.fn(() => Promise.resolve({ data: [], error: null })),
      remove: vi.fn(() => Promise.resolve({ data: [], error: null })),
    })),
  }

  fn.auth = {
    getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    signInWithPassword: vi.fn(() => Promise.resolve({ data: null, error: null })),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
  }

  function setQueryResult(result: { data: unknown; error?: Error | null }) {
    const response: QueryResponse = { data: result.data, error: result.error ?? null }
    fn.single = vi.fn(() => response)
    fn.maybeSingle = vi.fn(() => response)
  }

  return { supabase: fn, setQueryResult }
}

export type MockSupabaseClient = ReturnType<typeof createMockSupabase>['supabase']
