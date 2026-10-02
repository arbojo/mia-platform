import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { reportDelivery, type MiaReply } from './mia-client.js'

/**
 * The delivery receipt is the only evidence that a send actually reached
 * WhatsApp. MIA writes the outgoing row before the bridge sends, so without this
 * call `status:'sent'` is a claim nobody verified — a failed send leaves the row
 * claiming success forever, which is the exact bug this endpoint closes.
 *
 * The two properties pinned here are the ones that would break silently:
 * a receipt must never throw (the message is already sent, so a throw reads as
 * a send failure and could resend a message the customer already received), and
 * it must never be reported as a confirmed send when MIA did not accept it.
 */
describe('reportDelivery', () => {
  const config = {
    miaAppUrl: 'https://mia.example.com',
    bridgeSecret: 'test-secret',
  } as never

  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('PLATFORM_JWT_PRIVATE_KEY', '')
    vi.stubEnv('PLATFORM_JWT_PUBLIC_KEY', '')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  const receipt = {
    businessId: 'biz-1',
    outgoingMessageId: 'row-1',
    status: 'sent' as const,
    externalId: 'WA_MSG_1',
  }

  it('posts the receipt to the delivery endpoint', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 })

    const ok = await reportDelivery(config, receipt)

    expect(ok).toBe(true)
    const call = fetchMock.mock.calls[0] as [string, RequestInit]
    const [url, init] = call
    expect(url).toBe('https://mia.example.com/api/channels/baileys/delivery')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toMatchObject({
      outgoingMessageId: 'row-1',
      status: 'sent',
      externalId: 'WA_MSG_1',
    })
  })

  it('reports a failure with the error text so MIA stops claiming sent', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 })

    await reportDelivery(config, {
      ...receipt,
      status: 'failed',
      externalId: null,
      error: 'socket hang up',
    })

    const call = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(call[1].body as string)).toMatchObject({
      status: 'failed',
      externalId: null,
      error: 'socket hang up',
    })
  })

  it('never throws when MIA is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'))

    await expect(reportDelivery(config, receipt)).resolves.toBe(false)
  })

  it('returns false (no throw) when MIA rejects the receipt', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Invalid bridge token'),
    })

    await expect(reportDelivery(config, receipt)).resolves.toBe(false)
  })

  it('sends the business id header in legacy shared-secret mode', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 })

    await reportDelivery(config, receipt)

    const call = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = call[1].headers as Record<string, string>
    expect(headers['x-mia-business-id']).toBe('biz-1')
    expect(headers['x-mia-webhook-secret']).toBe('test-secret')
  })

  it('always carries an abort signal so the send path cannot hang', async () => {
    fetchMock.mockRejectedValue(new Error('aborted'))

    await reportDelivery(config, receipt, 5_000)

    const call = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(call[1].signal).toBeDefined()
  })
})

describe('MiaReply carries what the receipt needs', () => {
  it('an active reply has both a row id and the business it belongs to', () => {
    const reply: MiaReply = {
      response: 'hola',
      customerId: 'c-1',
      conversationId: 'conv-1',
      deliver: true,
      businessId: 'biz-1',
      outgoingMessageId: 'row-1',
    }

    expect(reply.outgoingMessageId).toBe('row-1')
    expect(reply.businessId).toBe('biz-1')
  })

  it('a shadow reply has no row id: there is nothing to confirm', () => {
    const reply: MiaReply = {
      response: 'hola',
      customerId: 'c-1',
      conversationId: 'conv-1',
      deliver: false,
      businessId: 'biz-1',
    }

    expect(reply.outgoingMessageId).toBeUndefined()
  })
})