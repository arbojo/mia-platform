import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BaileysAdapter } from '@/lib/channels/adapters/baileys'

describe('BaileysAdapter', () => {
  const adapter = new BaileysAdapter()

  beforeEach(() => {
    vi.resetModules()
    process.env.WHATSAPP_BRIDGE_URL = 'http://localhost:8787'
    process.env.WHATSAPP_BRIDGE_SECRET = 'test-secret'
  })

  afterEach(() => {
    delete process.env.WHATSAPP_BRIDGE_URL
    delete process.env.WHATSAPP_BRIDGE_SECRET
    vi.restoreAllMocks()
  })

  describe('receiveMessage', () => {
    it('parses an interactive quick_reply payload', async () => {
      const result = await adapter.receiveMessage({
        message: {
          businessId: 'b1',
          externalId: 'ext-1',
          customerExternalId: 'wa-123',
          content: 'Envíos',
          contentType: 'text',
          payload: { type: 'quick_reply', id: 'intent:shipping', title: 'Envíos' },
        },
      })

      expect(result.channel).toBe('whatsapp')
      expect(result.payload).toEqual({ type: 'quick_reply', id: 'intent:shipping', title: 'Envíos' })
      expect(result.content).toBe('Envíos')
      expect(result.metadata.businessId).toBe('b1')
    })

    it('parses a list selection payload', async () => {
      const result = await adapter.receiveMessage({
        message: {
          businessId: 'b1',
          externalId: 'ext-2',
          customerExternalId: 'wa-123',
          content: 'Bota de Cuero',
          contentType: 'text',
          payload: { type: 'list', id: 'p1', title: 'Bota de Cuero' },
        },
      })

      expect(result.payload?.type).toBe('list')
      expect(result.payload?.id).toBe('p1')
    })

    it('leaves payload undefined when absent', async () => {
      const result = await adapter.receiveMessage({
        message: { businessId: 'b1', content: 'Hola', contentType: 'text' },
      })

      expect(result.payload).toBeUndefined()
    })

    it('throws on missing content', async () => {
      await expect(
        adapter.receiveMessage({ message: { businessId: 'b1' } })
      ).rejects.toThrow('Invalid Baileys message format')
    })
  })

  describe('sendMessage', () => {
    it('forwards interactive component in the request body', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await adapter.sendMessage(
        {
          id: 'conn-1',
          businessId: 'b1',
          assistantId: 'a1',
          channel: 'whatsapp',
          status: 'connected',
          credentials: {},
          configuration: {},
          lastSync: null,
          errorMessage: null,
        },
        {
          content: 'Estos son nuestros productos',
          contentType: 'text',
          metadata: {
            to: 'wa-123',
            businessId: 'b1',
          },
          interactive: {
            type: 'list',
            text: 'Elige un producto',
            buttonText: 'Ver productos',
            sections: [{ title: 'Productos', rows: [{ id: 'p1', title: 'Bota de Cuero', description: '$150' }] }],
          },
        }
      )

      expect(result.success).toBe(true)
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
      expect(body.to).toBeDefined()
      expect(body.content).toBe('Estos son nuestros productos')
      expect(body.interactive).toBeDefined()
      expect(body.interactive.type).toBe('list')
    })

    it('returns failure when bridge is not configured', async () => {
      delete process.env.WHATSAPP_BRIDGE_SECRET

      const result = await adapter.sendMessage(
        {
          id: 'conn-1',
          businessId: 'b1',
          assistantId: 'a1',
          channel: 'whatsapp',
          status: 'connected',
          credentials: {},
          configuration: {},
          lastSync: null,
          errorMessage: null,
        },
        { content: 'Hola', contentType: 'text' }
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('not configured')
    })
  })
})
