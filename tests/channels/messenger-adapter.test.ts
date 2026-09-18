import crypto from 'crypto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MessengerAdapter } from '@/lib/channels/adapters/messenger'
import type { ChannelConnection } from '@/lib/channels/types'

describe('MessengerAdapter', () => {
  const adapter = new MessengerAdapter()

  beforeEach(() => {
    process.env.MESSENGER_APP_SECRET = 'app-secret'
    process.env.MESSENGER_VERIFY_TOKEN = 'verify-token'
  })

  afterEach(() => {
    delete process.env.MESSENGER_APP_SECRET
    delete process.env.MESSENGER_VERIFY_TOKEN
    vi.restoreAllMocks()
  })

  describe('channel', () => {
    it('identifies as messenger channel', () => {
      expect(adapter.channel).toBe('messenger')
    })
  })

  describe('receiveMessage', () => {
    it('parses a text message webhook into a NormalizedMessage', async () => {
      const result = await adapter.receiveMessage({
        object: 'page',
        entry: [
          {
            id: 'page-1',
            messaging: [
              {
                sender: { id: 'psid-1' },
                recipient: { id: 'page-1' },
                timestamp: 1700000000000,
                message: { mid: 'mid-1', text: 'Hola, quiero comprar botas' },
              },
            ],
          },
        ],
      })

      expect(result.channel).toBe('messenger')
      expect(result.content).toBe('Hola, quiero comprar botas')
      expect(result.customerExternalId).toBe('psid-1')
      expect(result.externalId).toBe('mid-1')
      expect(result.contentType).toBe('text')
      expect(result.metadata.pageId).toBe('page-1')
      expect(result.metadata.psid).toBe('psid-1')
      expect(result.receivedAt).toBeInstanceOf(Date)
    })

    it('maps a quick reply payload into the normalized payload', async () => {
      const result = await adapter.receiveMessage({
        object: 'page',
        entry: [
          {
            id: 'page-1',
            messaging: [
              {
                sender: { id: 'psid-1' },
                message: {
                  mid: 'mid-2',
                  text: 'Bota de Cuero',
                  quick_reply: { payload: 'intent:product' },
                },
              },
            ],
          },
        ],
      })

      expect(result.content).toBe('Bota de Cuero')
      expect(result.payload).toEqual({
        type: 'quick_reply',
        id: 'intent:product',
        title: 'Bota de Cuero',
      })
    })

    it('parses a postback event', async () => {
      const result = await adapter.receiveMessage({
        object: 'page',
        entry: [
          {
            id: 'page-1',
            messaging: [
              {
                sender: { id: 'psid-1' },
                postback: { mid: 'mid-3', title: 'Comenzar', payload: 'GET_STARTED' },
              },
            ],
          },
        ],
      })

      expect(result.externalId).toBe('mid-3')
      expect(result.content).toBe('Comenzar')
      expect(result.payload).toEqual({
        type: 'quick_reply',
        id: 'GET_STARTED',
        title: 'Comenzar',
      })
    })

    it('normalizes image attachments', async () => {
      const result = await adapter.receiveMessage({
        object: 'page',
        entry: [
          {
            id: 'page-1',
            messaging: [
              {
                sender: { id: 'psid-1' },
                message: {
                  mid: 'mid-4',
                  attachments: [{ type: 'image' }],
                },
              },
            ],
          },
        ],
      })

      expect(result.contentType).toBe('image')
      expect(result.content).toBe('[Imagen recibida]')
    })

    it('skips delivery/read events without message or postback', async () => {
      const failing = adapter.receiveMessage({
        object: 'page',
        entry: [
          {
            id: 'page-1',
            messaging: [{ sender: { id: 'psid-1' }, delivery: { mids: ['mid-9'] } }],
          },
        ],
      })

      await expect(failing).rejects.toThrow('Invalid Messenger message format')
    })

    it('throws when the object is not a page', async () => {
      await expect(adapter.receiveMessage({ object: 'other' })).rejects.toThrow(
        'Invalid Messenger message format'
      )
    })
  })

  describe('validateWebhook', () => {
    it('returns false without a signature', () => {
      expect(adapter.validateWebhook('', '{}')).toBe(false)
    })

    it('accepts a valid sha256 signature', () => {
      const body = '{"hello":"world"}'
      const expected = crypto
        .createHmac('sha256', 'app-secret')
        .update(body)
        .digest('hex')
      expect(adapter.validateWebhook(`sha256=${expected}`, body)).toBe(true)
    })

    it('rejects a tampered body', () => {
      const expected = crypto
        .createHmac('sha256', 'app-secret')
        .update('{"hello":"world"}')
        .digest('hex')
      expect(adapter.validateWebhook(`sha256=${expected}`, '{"hello":"tampered"}')).toBe(false)
    })

    it('falls back to WHATSAPP_APP_SECRET when MESSENGER_APP_SECRET is absent', () => {
      delete process.env.MESSENGER_APP_SECRET
      process.env.WHATSAPP_APP_SECRET = 'shared-secret'

      const body = '{"hello":"world"}'
      const expected = crypto
        .createHmac('sha256', 'shared-secret')
        .update(body)
        .digest('hex')

      expect(adapter.validateWebhook(`sha256=${expected}`, body)).toBe(true)
    })
  })

  describe('sendMessage', () => {
    const connection: ChannelConnection = {
      id: 'conn-1',
      businessId: 'b1',
      assistantId: 'a1',
      channel: 'messenger',
      status: 'connected',
      credentials: { page_id: 'page-1', access_token: 'page-token' },
      configuration: {},
      lastSync: null,
      errorMessage: null,
    }

    it('posts a text message to the Send API with the recipient PSID', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message_id: 'mid-out-1' }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await adapter.sendMessage(connection, {
        content: 'Respuesta',
        contentType: 'text',
        metadata: { psid: 'psid-1' },
      })

      expect(result.success).toBe(true)
      expect(result.externalId).toBe('mid-out-1')

      const [url, init] = fetchMock.mock.calls[0]
      expect(String(url)).toContain('access_token=page-token')
      const body = JSON.parse(init.body as string)
      expect(body.messaging_type).toBe('RESPONSE')
      expect(body.recipient.id).toBe('psid-1')
      expect(body.message.text).toBe('Respuesta')
    })

    it('sends an image attachment when imageUrl is provided', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message_id: 'mid-out-2' }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await adapter.sendMessage(connection, {
        content: 'Respuesta con imagen',
        contentType: 'text',
        metadata: { psid: 'psid-1', imageUrl: 'https://cdn.example.com/media/1.png' },
      })

      expect(result.success).toBe(true)
      const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body)
      expect(body.message.attachment.type).toBe('image')
      expect(body.message.attachment.payload.url).toBe('https://cdn.example.com/media/1.png')
    })

    it('returns failure when the access token is missing', async () => {
      const result = await adapter.sendMessage(
        { ...connection, credentials: { page_id: 'page-1' } },
        { content: 'Hola', contentType: 'text', metadata: { psid: 'psid-1' } }
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('not configured')
    })

    it('returns failure when no recipient PSID is available', async () => {
      const result = await adapter.sendMessage(connection, {
        content: 'Hola',
        contentType: 'text',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('No recipient PSID')
    })

    it('returns the Graph error message on failure', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Message send failure' } }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await adapter.sendMessage(connection, {
        content: 'Hola',
        contentType: 'text',
        metadata: { psid: 'psid-1' },
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Message send failure')
    })
  })

  describe('setTyping', () => {
    const connection: ChannelConnection = {
      id: 'conn-1',
      businessId: 'b1',
      assistantId: 'a1',
      channel: 'messenger',
      status: 'connected',
      credentials: { page_id: 'page-1', access_token: 'page-token' },
      configuration: {},
      lastSync: null,
      errorMessage: null,
    }

    it('posts typing_on to the Send API', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
      vi.stubGlobal('fetch', fetchMock)

      await adapter.setTyping(connection, 'psid-1', true)

      const [url, init] = fetchMock.mock.calls[0]
      expect(String(url)).toContain('/me/messages')
      expect(String(url)).toContain('access_token=page-token')
      const body = JSON.parse(init.body as string)
      expect(body.sender_action).toBe('typing_on')
      expect(body.recipient.id).toBe('psid-1')
    })

    it('posts typing_off to clear the indicator', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
      vi.stubGlobal('fetch', fetchMock)

      await adapter.setTyping(connection, 'psid-1', false)

      const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body)
      expect(body.sender_action).toBe('typing_off')
    })

    it('does nothing without an access token or recipient', async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      await adapter.setTyping({ ...connection, credentials: {} }, 'psid-1', true)
      await adapter.setTyping(connection, '', true)

      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('swallows transport failures (best-effort presence)', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
      vi.stubGlobal('fetch', fetchMock)

      await expect(adapter.setTyping(connection, 'psid-1', true)).resolves.toBeUndefined()
    })
  })

  describe('getStatus', () => {
    it('returns disconnected without an access token', async () => {
      const result = await adapter.getStatus({
        id: 'conn-1',
        businessId: 'b1',
        assistantId: 'a1',
        channel: 'messenger',
        status: 'disconnected',
        credentials: {},
        configuration: {},
        lastSync: null,
        errorMessage: null,
      })

      expect(result).toBe('disconnected')
    })

    it('returns connected when the page API responds ok', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
      vi.stubGlobal('fetch', fetchMock)

      const result = await adapter.getStatus({
        id: 'conn-1',
        businessId: 'b1',
        assistantId: 'a1',
        channel: 'messenger',
        status: 'connected',
        credentials: { access_token: 'page-token' },
        configuration: {},
        lastSync: null,
        errorMessage: null,
      })

      expect(result).toBe('connected')
    })

    it('returns error when the page API fails', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: false })
      vi.stubGlobal('fetch', fetchMock)

      const result = await adapter.getStatus({
        id: 'conn-1',
        businessId: 'b1',
        assistantId: 'a1',
        channel: 'messenger',
        status: 'connected',
        credentials: { access_token: 'page-token' },
        configuration: {},
        lastSync: null,
        errorMessage: null,
      })

      expect(result).toBe('error')
    })
  })
})