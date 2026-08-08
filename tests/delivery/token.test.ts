import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/delivery/db', () => ({
  createDeliveryAdmin: vi.fn(),
}))

import {
  generateOpaqueToken,
  scryptHash,
  sha256,
  createMagicLinkRecord,
  buildSessionCookie,
  createSession,
  authenticateSession,
  verifyMagicLink,
  SESSION_TTL_MS,
  MAGIC_TOKEN_TTL_MS,
} from '@/lib/delivery/token'
import { createDeliveryAdmin } from '@/lib/delivery/db'
import { DeliveryError } from '@/lib/delivery/errors'
import type { DeliveryDriver } from '@/lib/delivery/types'

const SECRET = 'a-very-long-driver-session-secret-that-exceeds-32-bytes!!'

const DRIVER_ID = '11111111-1111-1111-1111-111111111111'
const BUSINESS_ID = '22222222-2222-2222-2222-222222222222'

function makeDriver(overrides: Partial<DeliveryDriver> = {}): DeliveryDriver {
  return {
    id: DRIVER_ID,
    business_id: BUSINESS_ID,
    sequential_number: 1,
    name: 'Carlos',
    phone: '+5491155551234',
    vehicle: 'moto',
    status: 'active',
    auth_token_hash: null,
    auth_token_salt: null,
    auth_token_expires_at: null,
    token_revoked_at: null,
    last_lat: null,
    last_lng: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

interface FakeResult {
  data?: unknown
  error?: unknown
}

interface FakeBuilder {
  select: (...args: unknown[]) => FakeBuilder
  eq: (...args: unknown[]) => FakeBuilder
  lt: (...args: unknown[]) => FakeBuilder
  neq: (...args: unknown[]) => FakeBuilder
  limit: (...args: unknown[]) => FakeBuilder
  order: (...args: unknown[]) => FakeBuilder
  in: (...args: unknown[]) => FakeBuilder
  single: () => Promise<FakeResult>
  maybeSingle: () => Promise<FakeResult>
  insert: (...args: unknown[]) => FakeBuilder
  update: (...args: unknown[]) => FakeBuilder
  then: (resolve: (v: FakeResult) => void, reject: (e: unknown) => void) => Promise<void>
  catch: () => FakeBuilder
}

function createFakeDb(results: Record<string, () => FakeResult>) {
  const fromMock = vi.fn((table: string) => {
    const getResult = results[table] ?? (() => ({ data: null, error: null }))
    const builder: FakeBuilder = {
      select: () => builder,
      eq: () => builder,
      lt: () => builder,
      neq: () => builder,
      limit: () => builder,
      order: () => builder,
      in: () => builder,
      single: () => Promise.resolve(getResult()),
      maybeSingle: () => Promise.resolve(getResult()),
      insert: () => builder,
      update: () => builder,
      then: (resolve, reject) => Promise.resolve(getResult()).then(resolve, reject),
      catch: () => builder,
    }
    return builder
  })
  vi.mocked(createDeliveryAdmin).mockReturnValue({ from: fromMock } as never)
  return fromMock
}

describe('token primitives', () => {
  beforeEach(() => {
    vi.stubEnv('DRIVER_SESSION_SECRET', SECRET)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('generates opaque base64url tokens', () => {
    const a = generateOpaqueToken()
    const b = generateOpaqueToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(a).not.toBe(b)
  })

  it('computes a stable 64-byte scrypt hash', () => {
    const a = scryptHash('token', 'salt')
    const b = scryptHash('token', 'salt')
    expect(a.equals(b)).toBe(true)
    expect(a.byteLength).toBe(64)
    expect(scryptHash('token', 'other-salt').equals(a)).toBe(false)
  })

  it('computes the documented sha256 value', () => {
    expect(sha256('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    )
  })

  it('creates a magic link record whose hash verifies the token', () => {
    const record = createMagicLinkRecord()
    expect(scryptHash(record.token, record.salt).toString('base64')).toBe(record.hash)
    const ttl = new Date(record.expiresAt).getTime() - Date.now()
    expect(ttl).toBeGreaterThan(MAGIC_TOKEN_TTL_MS - 5_000)
    expect(ttl).toBeLessThanOrEqual(MAGIC_TOKEN_TTL_MS)
  })

  it('signs a 3-part JWT session cookie', () => {
    const cookie = buildSessionCookie(DRIVER_ID, BUSINESS_ID, 'opaque-token')
    expect(cookie.split('.')).toHaveLength(3)
  })
})

describe('authenticateSession', () => {
  beforeEach(() => {
    vi.stubEnv('DRIVER_SESSION_SECRET', SECRET)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('rejects a tampered cookie value', async () => {
    const fromMock = createFakeDb({})
    await expect(authenticateSession('not.a.jwt')).rejects.toMatchObject({
      code: 'DRIVER_UNAUTHORIZED',
      statusCode: 401,
    })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('returns the driver without sliding when the session is fresh', async () => {
    const driver = makeDriver()
    const session = {
      id: 'session-1',
      token_hash: sha256('opaque-token'),
      business_id: BUSINESS_ID,
      expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
      revoked_at: null,
    }
    createFakeDb({
      driver_sessions: () => ({ data: session }),
      drivers: () => ({ data: driver }),
    })

    const cookie = buildSessionCookie(DRIVER_ID, BUSINESS_ID, 'opaque-token')
    const result = await authenticateSession(cookie)
    expect(result.driver.id).toBe(DRIVER_ID)
    expect(result.slideTo).toBeNull()
  })

  it('rejects an expired session', async () => {
    createFakeDb({
      driver_sessions: () => ({
        data: {
          id: 'session-1',
          token_hash: sha256('opaque-token'),
          business_id: BUSINESS_ID,
          expires_at: new Date(Date.now() - 1000).toISOString(),
          revoked_at: null,
        },
      }),
      drivers: () => ({ data: makeDriver() }),
    })

    const cookie = buildSessionCookie(DRIVER_ID, BUSINESS_ID, 'opaque-token')
    await expect(authenticateSession(cookie)).rejects.toMatchObject({
      code: 'DRIVER_UNAUTHORIZED',
    })
  })

  it('rejects a revoked session', async () => {
    createFakeDb({
      driver_sessions: () => ({
        data: {
          id: 'session-1',
          token_hash: sha256('opaque-token'),
          business_id: BUSINESS_ID,
          expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
          revoked_at: new Date().toISOString(),
        },
      }),
      drivers: () => ({ data: makeDriver() }),
    })

    const cookie = buildSessionCookie(DRIVER_ID, BUSINESS_ID, 'opaque-token')
    await expect(authenticateSession(cookie)).rejects.toMatchObject({
      code: 'DRIVER_UNAUTHORIZED',
    })
  })

  it('slides the session when less than the threshold remains', async () => {
    const driver = makeDriver()
    const session = {
      id: 'session-1',
      token_hash: sha256('opaque-token'),
      business_id: BUSINESS_ID,
      expires_at: new Date(Date.now() + 60 * 1000).toISOString(),
      revoked_at: null,
    }
    const fromMock = createFakeDb({
      driver_sessions: () => ({ data: session }),
      drivers: () => ({ data: driver }),
    })

    const cookie = buildSessionCookie(DRIVER_ID, BUSINESS_ID, 'opaque-token')
    const result = await authenticateSession(cookie)
    expect(result.slideTo).not.toBeNull()
    expect(result.slideTo?.split('.')).toHaveLength(3)

    const updateCall = fromMock.mock.calls.find(([table]) => table === 'driver_sessions')
    expect(updateCall).toBeDefined()
  })

  it('fails when the driver does not belong to the session business', async () => {
    createFakeDb({
      driver_sessions: () => ({
        data: {
          id: 'session-1',
          token_hash: sha256('opaque-token'),
          business_id: 'OTHER-BUSINESS',
          expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
          revoked_at: null,
        },
      }),
      drivers: () => ({ data: null }),
    })

    const cookie = buildSessionCookie(DRIVER_ID, BUSINESS_ID, 'opaque-token')
    await expect(authenticateSession(cookie)).rejects.toMatchObject({
      code: 'DRIVER_UNAUTHORIZED',
    })
  })
})

describe('createSession', () => {
  beforeEach(() => {
    vi.stubEnv('DRIVER_SESSION_SECRET', SECRET)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('persists a hashed session and returns the opaque token', async () => {
    const fromMock = createFakeDb({})
    const result = await createSession(DRIVER_ID, BUSINESS_ID)

    expect(result.sessionToken).not.toBeNull()
    expect(result.sessionToken.split('.').length).toBe(1)

    const ttl = new Date(result.expiresAt).getTime() - Date.now()
    expect(ttl).toBeGreaterThan(SESSION_TTL_MS - 5_000)
    expect(ttl).toBeLessThanOrEqual(SESSION_TTL_MS)

    const insertCall = fromMock.mock.calls.find(([table]) => table === 'driver_sessions')
    expect(insertCall).toBeDefined()
  })
})

describe('verifyMagicLink', () => {
  beforeEach(() => {
    vi.stubEnv('DRIVER_SESSION_SECRET', SECRET)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('rejects an empty token', async () => {
    createFakeDb({})
    await expect(verifyMagicLink(DRIVER_ID, '')).rejects.toMatchObject({
      code: 'DRIVER_UNAUTHORIZED',
      statusCode: 401,
    })
  })

  it('accepts a driver with a valid unexpired token', async () => {
    const record = createMagicLinkRecord()
    const driver = makeDriver({
      auth_token_hash: record.hash,
      auth_token_salt: record.salt,
      auth_token_expires_at: record.expiresAt,
      token_revoked_at: null,
    })
    createFakeDb({ drivers: () => ({ data: driver }) })

    const result = await verifyMagicLink(DRIVER_ID, record.token)
    expect(result.id).toBe(DRIVER_ID)
  })

  it('rejects a token that does not match the stored hash', async () => {
    const record = createMagicLinkRecord()
    const driver = makeDriver({
      auth_token_hash: record.hash,
      auth_token_salt: record.salt,
      auth_token_expires_at: record.expiresAt,
      token_revoked_at: null,
    })
    createFakeDb({ drivers: () => ({ data: driver }) })

    await expect(verifyMagicLink(DRIVER_ID, 'wrong-token')).rejects.toBeInstanceOf(
      DeliveryError
    )
  })

  it('rejects an expired token', async () => {
    const record = createMagicLinkRecord()
    const driver = makeDriver({
      auth_token_hash: record.hash,
      auth_token_salt: record.salt,
      auth_token_expires_at: new Date(Date.now() - 1000).toISOString(),
      token_revoked_at: null,
    })
    createFakeDb({ drivers: () => ({ data: driver }) })

    await expect(verifyMagicLink(DRIVER_ID, record.token)).rejects.toMatchObject({
      code: 'DRIVER_UNAUTHORIZED',
    })
  })
})
