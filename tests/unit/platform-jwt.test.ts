import { describe, it, expect, beforeAll } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'
import {
  signBridgeToken,
  verifyBridgeToken,
  signLegacySessionToken,
  verifyLegacySessionToken,
  isBridgeJwtConfigured,
} from '@/lib/platform/jwt'

const BUSINESS_ID = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'

describe('platform jwt', () => {
  beforeAll(() => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    process.env.PLATFORM_JWT_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    process.env.PLATFORM_JWT_PUBLIC_KEY = publicKey.export({ type: 'spki', format: 'pem' }).toString()
  })

  it('isBridgeJwtConfigured returns true when keys are set', () => {
    expect(isBridgeJwtConfigured()).toBe(true)
  })

  it('signs and verifies bridge-api token scoped to businessId', async () => {
    const token = await signBridgeToken(BUSINESS_ID, 'bridge-api')
    const verified = await verifyBridgeToken(token, 'bridge-api', BUSINESS_ID)
    expect(verified.businessId).toBe(BUSINESS_ID)
    expect(verified.jti).toBeTruthy()
  })

  it('rejects wrong audience', async () => {
    const token = await signBridgeToken(BUSINESS_ID, 'bridge-ws')
    await expect(verifyBridgeToken(token, 'bridge-api', BUSINESS_ID)).rejects.toThrow()
  })

  it('rejects businessId mismatch', async () => {
    const token = await signBridgeToken(BUSINESS_ID, 'bridge-api')
    await expect(
      verifyBridgeToken(token, 'bridge-api', '00000000-0000-0000-0000-000000000000')
    ).rejects.toThrow()
  })

  it('legacy HMAC tokens remain compatible', () => {
    const secret = 'test-secret'
    const token = signLegacySessionToken(secret, BUSINESS_ID)
    expect(verifyLegacySessionToken(secret, BUSINESS_ID, token)).toBe(true)
    expect(verifyLegacySessionToken(secret, 'other-id', token)).toBe(false)
  })
})
