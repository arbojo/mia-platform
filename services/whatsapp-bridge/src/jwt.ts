import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto'
import { SignJWT, jwtVerify, importPKCS8, importSPKI } from 'jose'

export type BridgeAudience = 'bridge-api' | 'bridge-ws' | 'bridge-webhook'

export const BRIDGE_JWT_ISSUER = 'mia-platform'
const TOKEN_TTL_SECONDS = 86_400

let cachedPrivateKey: CryptoKey | null = null
let cachedPublicKey: CryptoKey | null = null

function normalizePem(value: string): string {
  return value.replace(/\\n/g, '\n').trim()
}

export function isBridgeJwtConfigured(): boolean {
  return Boolean(process.env.PLATFORM_JWT_PRIVATE_KEY && process.env.PLATFORM_JWT_PUBLIC_KEY)
}

function getPrivateKeyPem(): string | null {
  const pem = process.env.PLATFORM_JWT_PRIVATE_KEY
  return pem ? normalizePem(pem) : null
}

function getPublicKeyPem(): string | null {
  const pem = process.env.PLATFORM_JWT_PUBLIC_KEY
  return pem ? normalizePem(pem) : null
}

async function getPrivateKey(): Promise<CryptoKey> {
  const pem = getPrivateKeyPem()
  if (!pem) throw new Error('PLATFORM_JWT_PRIVATE_KEY is not configured')
  if (!cachedPrivateKey) {
    cachedPrivateKey = await importPKCS8(pem, 'RS256')
  }
  return cachedPrivateKey
}

async function getPublicKey(): Promise<CryptoKey> {
  const pem = getPublicKeyPem()
  if (!pem) throw new Error('PLATFORM_JWT_PUBLIC_KEY is not configured')
  if (!cachedPublicKey) {
    cachedPublicKey = await importSPKI(pem, 'RS256')
  }
  return cachedPublicKey
}

export async function signBridgeToken(
  businessId: string,
  audience: BridgeAudience
): Promise<string> {
  const privateKey = await getPrivateKey()
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject(businessId)
    .setAudience(audience)
    .setIssuer(BRIDGE_JWT_ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .setJti(randomUUID())
    .sign(privateKey)
}

export async function verifyBridgeToken(
  token: string,
  audience: BridgeAudience,
  expectedBusinessId?: string
): Promise<{ businessId: string; jti: string }> {
  const publicKey = await getPublicKey()
  const { payload } = await jwtVerify(token, publicKey, {
    issuer: BRIDGE_JWT_ISSUER,
    audience,
  })

  const businessId = payload.sub
  if (!businessId || typeof businessId !== 'string') {
    throw new Error('JWT missing sub (businessId)')
  }
  if (expectedBusinessId && businessId !== expectedBusinessId) {
    throw new Error('JWT businessId mismatch')
  }

  const jti = payload.jti
  if (!jti || typeof jti !== 'string') {
    throw new Error('JWT missing jti')
  }

  return { businessId, jti }
}

export function signLegacySessionToken(secret: string, businessId: string): string {
  return createHmac('sha256', secret).update(businessId).digest('base64url')
}

export function verifyLegacySessionToken(
  secret: string,
  businessId: string,
  token: string
): boolean {
  const expected = signLegacySessionToken(secret, businessId)
  const a = Buffer.from(expected)
  const b = Buffer.from(token)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function verifyHttpAuth(
  headers: Record<string, string | string[] | undefined>,
  bridgeSecret: string,
  businessId: string
): Promise<boolean> {
  const authHeader = headers.authorization
  const bearer =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null

  if (bearer && isBridgeJwtConfigured()) {
    try {
      await verifyBridgeToken(bearer, 'bridge-api', businessId)
      return true
    } catch {
      // fall through to legacy
    }
  }

  const legacyHeader = headers['x-mia-bridge-secret']
  return typeof legacyHeader === 'string' && legacyHeader === bridgeSecret
}

export async function verifyWsAuth(
  token: string,
  bridgeSecret: string,
  businessId: string
): Promise<boolean> {
  if (isBridgeJwtConfigured()) {
    try {
      await verifyBridgeToken(token, 'bridge-ws', businessId)
      return true
    } catch {
      // fall through
    }
  }
  return verifyLegacySessionToken(bridgeSecret, businessId, token)
}
