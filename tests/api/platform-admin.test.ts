import { describe, it, expect, vi, beforeEach } from 'vitest'

const getUserMock = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: getUserMock },
  })),
}))

const adminClientMock = vi.fn(() => ({
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      order: vi.fn(() => ({
        then: (resolve: (r: { data: unknown[]; error: null }) => void) =>
          resolve({ data: [], error: null }),
      })),
      in: vi.fn(() => ({
        then: (resolve: (r: { data: unknown[]; error: null }) => void) =>
          resolve({ data: [], error: null }),
      })),
      then: (resolve: (r: { data: unknown[]; error: null }) => void) =>
        resolve({ data: [], error: null }),
    })),
  })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: adminClientMock,
}))

import { requirePlatformOwner } from '@/lib/auth'
import { ApiForbiddenError } from '@/lib/api-error'

const ownerUser = { id: 'owner-uuid-123', email: 'admin@mia.test' }
const regularUser = { id: 'regular-user-456', email: 'user@tenant.test' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('requirePlatformOwner', () => {
  it('returns auth result when user matches PLATFORM_OWNER_ID', async () => {
    vi.stubEnv('PLATFORM_OWNER_ID', 'owner-uuid-123')
    getUserMock.mockResolvedValue({ data: { user: ownerUser } })

    const result = await requirePlatformOwner()
    expect(result.user.id).toBe('owner-uuid-123')
  })

  it('throws ApiForbiddenError when user does not match', async () => {
    vi.stubEnv('PLATFORM_OWNER_ID', 'owner-uuid-123')
    getUserMock.mockResolvedValue({ data: { user: regularUser } })

    await expect(requirePlatformOwner()).rejects.toBeInstanceOf(ApiForbiddenError)
  })

  it('throws ApiForbiddenError when PLATFORM_OWNER_ID is undefined', async () => {
    vi.stubEnv('PLATFORM_OWNER_ID', undefined)
    getUserMock.mockResolvedValue({ data: { user: ownerUser } })

    await expect(requirePlatformOwner()).rejects.toBeInstanceOf(ApiForbiddenError)
  })

  it('throws ApiForbiddenError when PLATFORM_OWNER_ID is empty string', async () => {
    vi.stubEnv('PLATFORM_OWNER_ID', '')
    getUserMock.mockResolvedValue({ data: { user: ownerUser } })

    await expect(requirePlatformOwner()).rejects.toBeInstanceOf(ApiForbiddenError)
  })
})

describe('ApiForbiddenError', () => {
  it('has correct name and message', () => {
    const err = new ApiForbiddenError()
    expect(err.name).toBe('ApiForbiddenError')
    expect(err.message).toBe('Acceso denegado')
  })
})
