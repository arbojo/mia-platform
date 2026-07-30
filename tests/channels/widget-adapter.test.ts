import { describe, it, expect } from 'vitest'
import { WidgetAdapter } from '@/lib/channels/adapters/widget'

describe('WidgetAdapter', () => {
  const adapter = new WidgetAdapter()

  describe('channel', () => {
    it('identifies as widget channel', () => {
      expect(adapter.channel).toBe('widget')
    })
  })

  describe('receiveMessage', () => {
    it('normalizes a valid webhook body into a NormalizedMessage', async () => {
      const result = await adapter.receiveMessage({
        message: 'Hola, quiero comprar botas',
        customerExternalId: 'visitor-abc',
        customerName: 'María',
        assistantId: 'asst-1',
      })

      expect(result.channel).toBe('widget')
      expect(result.content).toBe('Hola, quiero comprar botas')
      expect(result.customerExternalId).toBe('visitor-abc')
      expect(result.customerName).toBe('María')
      expect(result.contentType).toBe('text')
      expect(result.metadata.assistantId).toBe('asst-1')
    })

    it('generates a fallback externalId', async () => {
      const result = await adapter.receiveMessage({
        message: 'test',
      })

      expect(result.externalId).toMatch(/^widget-\d+-[a-z0-9]+$/)
    })

    it('defaults customerExternalId to anonymous when missing', async () => {
      const result = await adapter.receiveMessage({
        message: 'test',
      })

      expect(result.customerExternalId).toBe('anonymous')
    })

    it('defaults content to empty string when missing', async () => {
      const result = await adapter.receiveMessage({})

      expect(result.content).toBe('')
    })

    it('preserves customerName when provided', async () => {
      const result = await adapter.receiveMessage({
        message: 'test',
        customerName: 'Carlos López',
      })

      expect(result.customerName).toBe('Carlos López')
    })

    it('leaves customerName undefined when not provided', async () => {
      const result = await adapter.receiveMessage({
        message: 'test',
      })

      expect(result.customerName).toBeUndefined()
    })

    it('returns a Date in receivedAt', async () => {
      const result = await adapter.receiveMessage({
        message: 'test',
      })

      expect(result.receivedAt).toBeInstanceOf(Date)
    })
  })

  describe('sendMessage', () => {
    it('returns success result', async () => {
      const result = await adapter.sendMessage(
        { id: 'conn-1', businessId: 'b1', assistantId: 'a1', channel: 'widget', status: 'connected', credentials: {}, configuration: {}, lastSync: null, errorMessage: null },
        { content: 'Respuesta', contentType: 'text' }
      )

      expect(result.success).toBe(true)
      expect(result.externalId).toBeDefined()
      expect(typeof result.externalId).toBe('string')
    })
  })

  describe('validateWebhook', () => {
    it('always returns true', () => {
      expect(adapter.validateWebhook('any-signature', 'any-body')).toBe(true)
      expect(adapter.validateWebhook('', '')).toBe(true)
    })
  })

  describe('getStatus', () => {
    it('always returns connected', async () => {
      const result = await adapter.getStatus(
        { id: 'conn-1', businessId: 'b1', assistantId: 'a1', channel: 'widget', status: 'disconnected', credentials: {}, configuration: {}, lastSync: null, errorMessage: null }
      )

      expect(result).toBe('connected')
    })
  })
})
