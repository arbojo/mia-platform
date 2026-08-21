import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto'
import { SignJWT, jwtVerify, importPKCS8, importSPKI } from 'jose'

export type BridgeAudience = 'bridge-api' | 'bridge-ws' | 'bridge-webhook'

export const BRIDGE_JWT_ISSUER = 'mia-platform'
const TOKEN_TTL_SECONDS = 86_400 // 24h

let cachedPrivateKey: CryptoKey | null = null
let cachedPublicKey: CryptoKey | null = null

function normalizePem(value: string): string {
  return value.replace(/\\n/g, '\n').trim()
}

function getPrivateKeyPem(): string {
  const pem = process.env.PLATFORM_JWT_PRIVATE_KEY
  if (!pem) {
    throw new Error('PLATFORM_JWT_PRIVATE_KEY is not configured')
  }
  return normalizePem(pem)
}

function getPublicKeyPem(): string {
  const pem = process.env.PLATFORM_JWT_PUBLIC_KEY
  if (!pem) {
    throw new Error('PLATFORM_JWT_PUBLIC_KEY is not configured')
  }
  return normalizePem(pem)
}

export function isBridgeJwtConfigured(): boolean {
  return Boolean(process.env.PLATFORM_JWT_PRIVATE_KEY && process.env.PLATFORM_JWT_PUBLIC_KEY)
}

async function getPrivateKey(): Promise<CryptoKey> {
  if (!cachedPrivateKey) {
    cachedPrivateKey = await importPKCS8(getPrivateKeyPem(), 'RS256')
  }
  return cachedPrivateKey
}

async function getPublicKey(): Promise<CryptoKey> {
  if (!cachedPublicKey) {
    cachedPublicKey = await importSPKI(getPublicKeyPem(), 'RS256')
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

export interface VerifiedBridgeToken {
  businessId: string
  audience: BridgeAudience
  jti: string
}

export async function verifyBridgeToken(
  token: string,
  audience: BridgeAudience,
  expectedBusinessId?: string
): Promise<VerifiedBridgeToken> {
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

  return { businessId, audience, jti }
}

/** HMAC fallback for transition period when JWT keys are not yet configured. */
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
