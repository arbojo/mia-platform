/**
 * JWT verification for webhook tokens from the WhatsApp Bridge.
 * Accepts both JWT (EdDSA) and HMAC (legacy) tokens.
 */
import { jwtVerify, type JWTPayload } from 'jose'
import { createHmac, timingSafeEqual } from 'node:crypto'

export interface WebhookJWTPayload extends JWTPayload {
  sub: string       // businessId
  aud: string       // 'webhook'
  bid: string       // businessId
}

/**
 * Verifies a webhook token from the bridge.
 * Accepts: (1) JWT with 'webhook' audience, (2) HMAC legacy.
 * Returns the businessId if valid, null otherwise.
 */
export async function verifyWebhookToken(
  token: string,
  bridgeSecret: string,
  jwtPublicKey?: string | null
): Promise<string | null> {
  // 1. Try JWT verification
  if (jwtPublicKey) {
    try {
      const publicKeyObj = await import('node:crypto').then((crypto) =>
        crypto.createPublicKey({ key: jwtPublicKey, format: 'pem', type: 'spki' })
      )

      const { payload } = await jwtVerify(token, publicKeyObj, {
        issuer: 'mia-bridge',
        audience: 'webhook',
      })

      return payload.sub ?? null
    } catch {
      // JWT failed, fall through to HMAC
    }
  }

  // 2. HMAC fallback: verify as base64url-encoded HMAC of businessId
  //    We can't recover businessId from HMAC alone, so we return null
  //    and let the caller handle the legacy case.
  return null
}

/**
 * Legacy HMAC verification. Returns true if the token matches the expected HMAC.
 */
export function verifyHMACToken(
  secret: string,
  businessId: string,
  token: string
): boolean {
  const expected = createHmac('sha256', secret).update(businessId).digest('base64url')
  const a = Buffer.from(expected)
  const b = Buffer.from(token)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Combined verification: tries JWT first, falls back to HMAC.
 * Returns { businessId, method } if valid, null otherwise.
 */
export async function verifyBridgeWebhookAuth(
  token: string,
  bridgeSecret: string,
  businessId: string,
  jwtPublicKey?: string | null
): Promise<{ businessId: string; method: 'jwt' | 'hmac' } | null> {
  // 1. Try JWT
  const jwtResult = await verifyWebhookToken(token, bridgeSecret, jwtPublicKey)
  if (jwtResult) {
    return { businessId: jwtResult, method: 'jwt' }
  }

  // 2. HMAC fallback
  if (verifyHMACToken(bridgeSecret, businessId, token)) {
    return { businessId, method: 'hmac' }
  }

  return null
}
