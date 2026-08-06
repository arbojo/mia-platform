import { describe, it, expect, vi, beforeEach } from 'vitest'

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(() => {
    throw new Error('NEXT_REDIRECT:/login')
  }),
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

const getUserMock = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: getUserMock,
    },
  })),
}))

import { requireAuth, requirePageAuth } from '@/lib/auth'
import { ApiAuthError } from '@/lib/api-error'

const mockUser = { id: 'user-1', email: 'a@b.c' }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('requireAuth', () => {
  it('devuelve supabase y user cuando hay sesión', async () => {
    getUserMock.mockResolvedValue({ data: { user: mockUser } })
    const result = await requireAuth()
    expect(result.user).toEqual(mockUser)
    expect(result.supabase).toBeDefined()
  })

  it('lanza ApiAuthError cuando no hay sesión', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    await expect(requireAuth()).rejects.toBeInstanceOf(ApiAuthError)
  })
})

describe('requirePageAuth', () => {
  it('redirige a /login cuando no hay sesión', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    await expect(requirePageAuth()).rejects.toThrow('NEXT_REDIRECT:/login')
    expect(redirectMock).toHaveBeenCalledWith('/login')
  })

  it('propaga el error cuando hay sesión', async () => {
    getUserMock.mockResolvedValue({ data: { user: mockUser } })
    const result = await requirePageAuth()
    expect(result.user).toEqual(mockUser)
    expect(redirectMock).not.toHaveBeenCalled()
  })
})
