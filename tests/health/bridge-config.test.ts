import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { checkBridgeConfiguration } from '@/lib/system/health'

const originalBridgeUrl = process.env.WHATSAPP_BRIDGE_URL
const originalBridgeSecret = process.env.WHATSAPP_BRIDGE_SECRET

beforeEach(() => {
  // Reset to clean state
  delete process.env.WHATSAPP_BRIDGE_URL
  delete process.env.WHATSAPP_BRIDGE_SECRET
})

afterEach(() => {
  // Restore original environment: unstub NODE_ENV first, then plain vars
  vi.unstubAllEnvs()
  process.env.WHATSAPP_BRIDGE_URL = originalBridgeUrl
  process.env.WHATSAPP_BRIDGE_SECRET = originalBridgeSecret
})

describe('checkBridgeConfiguration', () => {
  describe('Production environment (NODE_ENV=production)', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production')
    })

    it('fails when WHATSAPP_BRIDGE_URL is missing', async () => {
      delete process.env.WHATSAPP_BRIDGE_URL
      process.env.WHATSAPP_BRIDGE_SECRET = 'secret-123'

      const result = await checkBridgeConfiguration()

      expect(result.status).toBe('failed')
      expect(result.id).toBe('bridge_configuration')
      expect(result.message).toContain('WHATSAPP_BRIDGE_URL')
      expect(result.message).toContain('variables requeridas ausentes')
      expect(result.origin).toBe('src/lib/baileys/config.ts')
    })

    it('fails when WHATSAPP_BRIDGE_SECRET is missing', async () => {
      process.env.WHATSAPP_BRIDGE_URL = 'https://bridge.example.com'
      delete process.env.WHATSAPP_BRIDGE_SECRET

      const result = await checkBridgeConfiguration()

      expect(result.status).toBe('failed')
      expect(result.id).toBe('bridge_configuration')
      expect(result.message).toContain('WHATSAPP_BRIDGE_SECRET')
      expect(result.message).toContain('variables requeridas ausentes')
    })

    it('fails when both URL and SECRET are missing', async () => {
      delete process.env.WHATSAPP_BRIDGE_URL
      delete process.env.WHATSAPP_BRIDGE_SECRET

      const result = await checkBridgeConfiguration()

      expect(result.status).toBe('failed')
      expect(result.message).toContain('WHATSAPP_BRIDGE_URL')
      expect(result.message).toContain('WHATSAPP_BRIDGE_SECRET')
      expect(result.remediation).toContain('Configura')
    })

    it('fails when WHATSAPP_BRIDGE_URL is localhost (sanity check)', async () => {
      process.env.WHATSAPP_BRIDGE_URL = 'http://localhost:8787'
      process.env.WHATSAPP_BRIDGE_SECRET = 'secret-123'

      const result = await checkBridgeConfiguration()

      expect(result.status).toBe('failed')
      expect(result.message).toContain('localhost')
      expect(result.message).toContain('En producción')
    })

    it('fails when WHATSAPP_BRIDGE_URL is 127.0.0.1 (sanity check)', async () => {
      process.env.WHATSAPP_BRIDGE_URL = 'http://127.0.0.1:8787'
      process.env.WHATSAPP_BRIDGE_SECRET = 'secret-123'

      const result = await checkBridgeConfiguration()

      expect(result.status).toBe('failed')
      expect(result.message).toContain('localhost')
    })

    it('passes when both URL and SECRET are configured with remote URL', async () => {
      process.env.WHATSAPP_BRIDGE_URL = 'https://bridge.fly.io/api'
      process.env.WHATSAPP_BRIDGE_SECRET = 'prod-secret-xyz'

      const result = await checkBridgeConfiguration()

      expect(result.status).toBe('passed')
      expect(result.id).toBe('bridge_configuration')
      expect(result.message).toContain('producción')
      expect(result.remediation).toBe('')
    })

    it('no silent degradation in production - fail-fast principle', async () => {
      // This test verifies INV-DEPLOY-004: "Missing required production env vars fail fast"
      delete process.env.WHATSAPP_BRIDGE_URL
      delete process.env.WHATSAPP_BRIDGE_SECRET

      const result = await checkBridgeConfiguration()

      // The result must be 'failed', not 'warning' or 'passed'
      // This prevents silent feature disabling
      expect(result.status).toBe('failed')
      expect(result.status).not.toBe('passed')
      expect(result.status).not.toBe('warning')
    })
  })

  describe('Development environment (NODE_ENV !== production)', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development')
    })

    it('warns when neither URL nor SECRET are configured', async () => {
      delete process.env.WHATSAPP_BRIDGE_URL
      delete process.env.WHATSAPP_BRIDGE_SECRET

      const result = await checkBridgeConfiguration()

      expect(result.status).toBe('warning')
      expect(result.id).toBe('bridge_configuration')
      expect(result.message).toContain('Bridge no configurado')
      expect(result.message).toContain('desarrollo')
    })

    it('warns when only URL is configured', async () => {
      process.env.WHATSAPP_BRIDGE_URL = 'http://localhost:8787'
      delete process.env.WHATSAPP_BRIDGE_SECRET

      const result = await checkBridgeConfiguration()

      expect(result.status).toBe('warning')
      expect(result.message).toContain('parcialmente habilitado')
      // Implementation reports the MISSING variable name in its message
      expect(result.message).toContain('secret')
    })

    it('warns when only SECRET is configured', async () => {
      delete process.env.WHATSAPP_BRIDGE_URL
      process.env.WHATSAPP_BRIDGE_SECRET = 'dev-secret'

      const result = await checkBridgeConfiguration()

      expect(result.status).toBe('warning')
      expect(result.message).toContain('parcialmente habilitado')
      // Implementation reports the MISSING variable name in its message
      expect(result.message).toContain('URL')
    })

    it('passes when localhost is configured in development', async () => {
      process.env.WHATSAPP_BRIDGE_URL = 'http://localhost:8787'
      process.env.WHATSAPP_BRIDGE_SECRET = 'dev-secret-123'

      const result = await checkBridgeConfiguration()

      expect(result.status).toBe('passed')
      expect(result.message).toContain('localhost')
      // Case-insensitive: implementation capitalizes ("Desarrollo ...")
      expect(result.message.toLowerCase()).toContain('desarrollo')
    })

    it('passes when fully configured with localhost in development', async () => {
      process.env.WHATSAPP_BRIDGE_URL = 'http://localhost:3000'
      process.env.WHATSAPP_BRIDGE_SECRET = 'test-secret'

      const result = await checkBridgeConfiguration()

      expect(result.status).toBe('passed')
      expect(result.message).toContain('Desarrollo con bridge local')
    })

    it('passes when fully configured with remote URL in development', async () => {
      process.env.WHATSAPP_BRIDGE_URL = 'https://staging-bridge.fly.io'
      process.env.WHATSAPP_BRIDGE_SECRET = 'staging-secret'

      const result = await checkBridgeConfiguration()

      expect(result.status).toBe('passed')
      expect(result.message).toContain('Bridge remoto configurado')
    })
  })

  describe('INV-DEPLOY-004 Compliance', () => {
    it('never silently disables in production', async () => {
      // Silent degradation is when missing env vars result in feature disabled without error
      // INV-DEPLOY-004 forbids this
      vi.stubEnv('NODE_ENV', 'production')
      delete process.env.WHATSAPP_BRIDGE_URL
      delete process.env.WHATSAPP_BRIDGE_SECRET

      const result = await checkBridgeConfiguration()

      // Must fail, not return 'passed' (which would indicate silent degradation)
      expect(result.status).toBe('failed')
      expect(result.origin).toBe('src/lib/baileys/config.ts')
    })

    it('provides remediation guidance in production failures', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      delete process.env.WHATSAPP_BRIDGE_URL
      process.env.WHATSAPP_BRIDGE_SECRET = 'secret'

      const result = await checkBridgeConfiguration()

      // Remediation must explain how to fix
      expect(result.remediation).toBeTruthy()
      expect(result.remediation).toContain('Configura')
      expect(result.remediation).toContain('secrets')
    })
  })
})
