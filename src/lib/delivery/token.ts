import crypto from 'crypto'
import { createDeliveryAdmin } from './db'
import { DeliveryError } from './errors'
import type { DeliveryDriver } from './types'

export const MAGIC_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000
export const SESSION_TTL_MS = 30 * 60 * 1000
export const SESSION_SLIDE_REMAINING_MS = 5 * 60 * 1000

export const SESSION_COOKIE = 'mia_driver_session'

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function getSessionSecret(): string {
  const secret = process.env.DRIVER_SESSION_SECRET
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new DeliveryError(
      'DRIVER_UNAUTHORIZED',
      'DRIVER_SESSION_SECRET no configurado (mínimo 32 bytes)',
      500
    )
  }
  return secret
}

export function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export function scryptHash(value: string, salt: string): Buffer {
  return crypto.scryptSync(value, salt, 64)
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

// -------------------------------------------------
// Magic link (un solo uso) almacenado en delivery.drivers
// -------------------------------------------------

export interface MagicLinkRecord {
  token: string
  salt: string
  hash: string
  expiresAt: string
}

export function createMagicLinkRecord(): MagicLinkRecord {
  const token = generateOpaqueToken()
  const salt = crypto.randomBytes(16).toString('base64url')
  return {
    token,
    salt,
    hash: scryptHash(token, salt).toString('base64'),
    expiresAt: new Date(Date.now() + MAGIC_TOKEN_TTL_MS).toISOString(),
  }
}

export async function storeMagicLink(driverId: string, record: MagicLinkRecord): Promise<void> {
  const supabase = createDeliveryAdmin()
  const { error } = await supabase
    .from('drivers')
    .update({
      auth_token_hash: record.hash,
      auth_token_salt: record.salt,
      auth_token_expires_at: record.expiresAt,
      token_revoked_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', driverId)

  if (error) {
    throw error
  }
}

export async function consumeMagicLink(driverId: string): Promise<void> {
  const supabase = createDeliveryAdmin()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('drivers')
    .update({
      auth_token_hash: null,
      auth_token_salt: null,
      token_revoked_at: now,
      updated_at: now,
    })
    .eq('id', driverId)

  if (error) {
    throw error
  }
}

export async function verifyMagicLink(driverId: string, token: string): Promise<DeliveryDriver> {
  if (!token) {
    throw new DeliveryError('DRIVER_UNAUTHORIZED', 'Token de acceso inválido', 401)
  }

  const supabase = createDeliveryAdmin()
  const { data: driver, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', driverId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!driver || !driver.auth_token_hash || !driver.auth_token_salt || driver.token_revoked_at) {
    throw new DeliveryError('DRIVER_UNAUTHORIZED', 'Token de acceso inválido o ya utilizado', 401)
  }

  if (!driver.auth_token_expires_at || new Date(driver.auth_token_expires_at).getTime() < Date.now()) {
    throw new DeliveryError('DRIVER_UNAUTHORIZED', 'Token de acceso expirado', 401)
  }

  const expected = scryptHash(token, driver.auth_token_salt)
  const received = Buffer.from(driver.auth_token_hash, 'base64')

  if (!safeEqual(expected, received)) {
    throw new DeliveryError('DRIVER_UNAUTHORIZED', 'Token de acceso inválido', 401)
  }

  return driver
}

// -------------------------------------------------
// Sesion corta (JWT HMAC HS256 + tabla driver_sessions)
// -------------------------------------------------

export interface SessionPayload {
  d: string
  b: string
  s: string
}

function signJwt(payload: SessionPayload, secret: string): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64url(JSON.stringify(payload))
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url')
  return `${header}.${body}.${signature}`
}

function verifyJwt(token: string): SessionPayload | null {
  const secret = getSessionSecret()
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [header, body, signature] = parts
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url')

  if (!safeEqual(Buffer.from(signature), Buffer.from(expected))) return null

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload
    if (typeof payload.d !== 'string' || typeof payload.b !== 'string' || typeof payload.s !== 'string') {
      return null
    }
    return payload
  } catch {
    return null
  }
}

export async function createSession(
  driverId: string,
  businessId: string
): Promise<{ sessionToken: string; expiresAt: string }> {
  const sessionToken = generateOpaqueToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()

  const supabase = createDeliveryAdmin()
  const { error } = await supabase.from('driver_sessions').insert({
    driver_id: driverId,
    business_id: businessId,
    token_hash: sha256(sessionToken),
    expires_at: expiresAt,
  })

  if (error) {
    throw error
  }

  return { sessionToken, expiresAt }
}

export function buildSessionCookie(
  driverId: string,
  businessId: string,
  sessionToken: string
): string {
  return signJwt({ d: driverId, b: businessId, s: sessionToken }, getSessionSecret())
}

export interface AuthenticatedDriver {
  driver: DeliveryDriver
  slideTo: string | null
}

export async function authenticateSession(cookieValue: string): Promise<AuthenticatedDriver> {
  // 1. Leer el token de sesion opaco desde la cookie JWT
  const payload = verifyJwt(cookieValue)
  if (!payload) {
    throw new DeliveryError('DRIVER_UNAUTHORIZED', 'Sesión inválida', 401)
  }

  // 2. Validar que la sesion exista y no este revocada/expirada
  const supabase = createDeliveryAdmin()
  const { data: session, error } = await supabase
    .from('driver_sessions')
    .select('*')
    .eq('token_hash', sha256(payload.s))
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!session || session.revoked_at) {
    throw new DeliveryError('DRIVER_UNAUTHORIZED', 'Sesión revocada', 401)
  }

  const now = Date.now()
  if (new Date(session.expires_at).getTime() < now) {
    throw new DeliveryError('DRIVER_UNAUTHORIZED', 'Sesión expirada', 401)
  }

  // 3. Cargar el driver y confirmar que la sesion pertenece al negocio
  const { data: driver, error: driverError } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', payload.d)
    .eq('business_id', payload.b)
    .eq('business_id', session.business_id)
    .maybeSingle()

  if (driverError) {
    throw driverError
  }

  if (!driver) {
    throw new DeliveryError('DRIVER_UNAUTHORIZED', 'Repartidor no encontrado', 401)
  }

  // 4. Renovacion deslizante cuando queda menos del umbral
  const remaining = new Date(session.expires_at).getTime() - now
  let slideTo: string | null = null

  if (remaining < SESSION_SLIDE_REMAINING_MS) {
    const refreshedToken = generateOpaqueToken()
    const newExpires = new Date(now + SESSION_TTL_MS).toISOString()
    const { error: slideError } = await supabase
      .from('driver_sessions')
      .update({ token_hash: sha256(refreshedToken), expires_at: newExpires, last_used_at: new Date().toISOString() })
      .eq('id', session.id)

    if (slideError) {
      throw slideError
    }

    slideTo = buildSessionCookie(driver.id, driver.business_id, refreshedToken)
  } else {
    await supabase
      .from('driver_sessions')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', session.id)
  }

  return { driver, slideTo }
}

export async function revokeSession(cookieValue: string): Promise<void> {
  const payload = verifyJwt(cookieValue)
  if (!payload) return

  const supabase = createDeliveryAdmin()
  await supabase
    .from('driver_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token_hash', sha256(payload.s))
}
