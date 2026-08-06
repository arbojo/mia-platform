import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      ok: (init?.status ?? 200) < 400,
      body,
      async json() {
        return body
      },
    }),
  },
}))

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('@/lib/system/language', () => ({
  getProfileLanguage: vi.fn(),
  saveProfileLanguage: vi.fn(),
}))

import { GET, PATCH } from '@/app/api/profile/language/route'
import { requireAuth } from '@/lib/auth'
import { ApiAuthError } from '@/lib/api-error'
import {
  getProfileLanguage,
  saveProfileLanguage,
} from '@/lib/system/language'

const mockedRequireAuth = vi.mocked(requireAuth)
const mockedGetProfileLanguage = vi.mocked(getProfileLanguage)
const mockedSaveProfileLanguage = vi.mocked(saveProfileLanguage)

beforeEach(() => {
  vi.clearAllMocks()
  mockedRequireAuth.mockResolvedValue({
    user: { id: 'user-1' },
    supabase: {},
  } as never)
})

describe('GET /api/profile/language', () => {
  it('devuelve el idioma del usuario', async () => {
    mockedGetProfileLanguage.mockResolvedValue('en')
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ language: 'en' })
  })

  it('devuelve 500 ante error inesperado', async () => {
    mockedRequireAuth.mockRejectedValue(new Error('Not authenticated'))
    const res = await GET()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('Not authenticated')
  })

  it('devuelve 401 cuando no hay sesión', async () => {
    mockedRequireAuth.mockRejectedValue(new ApiAuthError())
    const res = await GET()
    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/profile/language', () => {
  it('guarda un idioma valido y lo devuelve', async () => {
    mockedSaveProfileLanguage.mockResolvedValue('pt')
    const res = await PATCH(
      new Request('http://localhost/api/profile/language', {
        method: 'PATCH',
        body: JSON.stringify({ language: 'pt' }),
      })
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ language: 'pt' })
  })

  it('normaliza un idioma invalido al default', async () => {
    mockedSaveProfileLanguage.mockResolvedValue('es')
    const res = await PATCH(
      new Request('http://localhost/api/profile/language', {
        method: 'PATCH',
        body: JSON.stringify({ language: 'xx' }),
      })
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ language: 'es' })
  })

  it('devuelve 500 cuando el save falla', async () => {
    mockedSaveProfileLanguage.mockRejectedValue(new Error('DB down'))
    const res = await PATCH(
      new Request('http://localhost/api/profile/language', {
        method: 'PATCH',
        body: JSON.stringify({ language: 'es' }),
      })
    )
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('DB down')
  })
})
