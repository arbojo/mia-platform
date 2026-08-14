import { vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface AdminCall {
  method: string
  args: unknown[]
}

export interface AdminMockOptions {
  existing?: { id: string; sku: string | null }[]
  updateError?: Error | null
  insertError?: Error | null
}

export function createAdminMock(options: AdminMockOptions = {}) {
  const calls: AdminCall[] = []
  const state = {
    existing: options.existing ?? [],
    updateError: options.updateError ?? null,
    insertError: options.insertError ?? null,
    pending: 'none' as 'none' | 'update' | 'insert',
  }

  const wrapper: Record<string, unknown> = { data: null, error: null }
  wrapper.then = (onFulfilled: (value: unknown) => unknown) => {
    const result =
      state.pending === 'update'
        ? { data: null, error: state.updateError }
        : state.pending === 'insert'
          ? { data: null, error: state.insertError }
          : { data: state.existing, error: null }
    state.pending = 'none'
    return Promise.resolve(result).then(onFulfilled)
  }
  for (const method of ['select', 'eq', 'order', 'limit', 'single', 'maybeSingle']) {
    wrapper[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return wrapper
    }
  }
  wrapper.update = (...args: unknown[]) => {
    state.pending = 'update'
    calls.push({ method: 'update', args })
    return wrapper
  }
  wrapper.insert = (...args: unknown[]) => {
    state.pending = 'insert'
    calls.push({ method: 'insert', args })
    return wrapper
  }

  const admin = {
    from: vi.fn(() => wrapper),
  } as unknown as SupabaseClient

  return { admin, calls }
}
