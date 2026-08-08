import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  normalizePhone,
  buildWaMeLink,
  buildDeliveryNotificationText,
  sendGraphText,
} from '@/lib/delivery/whatsapp'

describe('normalizePhone', () => {
  it('strips non-digit characters', () => {
    expect(normalizePhone('+54 9 11 5555-1234')).toBe('5491155551234')
  })

  it('returns empty string for missing values', () => {
    expect(normalizePhone(null)).toBe('')
    expect(normalizePhone(undefined)).toBe('')
    expect(normalizePhone('')).toBe('')
  })
})

describe('buildWaMeLink', () => {
  it('builds a wa.me link with an encoded text', () => {
    const text = 'Hola, ¿cómo va?'
    const link = buildWaMeLink('+5491155551234', text)
    expect(link).toBe(`https://wa.me/5491155551234?text=${encodeURIComponent(text)}`)
  })

  it('returns empty when there is no phone', () => {
    expect(buildWaMeLink(null, 'Hola')).toBe('')
  })
})

describe('buildDeliveryNotificationText', () => {
  const base = {
    orderNumber: 'ORD-000001',
    customerName: 'Juan',
    driverName: 'Carlos',
    amount: null,
    paidAtSale: false,
  }

  it('builds the on-the-way message with an amount due', () => {
    const text = buildDeliveryNotificationText('voy_en_camino', {
      ...base,
      amount: 120,
    })
    expect(text).toContain('ORD-000001 va en camino')
    expect(text).toContain('Carlos')
    expect(text).toContain('Importe a abonar: $120')
  })

  it('builds the arrived message', () => {
    const text = buildDeliveryNotificationText('ya_estoy_aqui', {
      ...base,
      amount: 120,
      paidAtSale: true,
    })
    expect(text).toContain('ya está en la puerta')
    expect(text).toContain('Pedido abonado: $120')
  })

  it('omits the amount line when there is no amount', () => {
    const text = buildDeliveryNotificationText('voy_en_camino', base)
    expect(text).not.toContain('$')
  })
})

describe('sendGraphText', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns ok on HTTP 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const result = await sendGraphText({
      phoneNumberId: '123',
      accessToken: 'token',
      to: '5491155551234',
      text: 'Hola',
    })
    expect(result.ok).toBe(true)
  })

  it('returns the API error message on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: { message: 'Rate limit exceeded' } }),
      })
    )
    const result = await sendGraphText({
      phoneNumberId: '123',
      accessToken: 'token',
      to: '5491155551234',
      text: 'Hola',
    })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Rate limit exceeded')
  })

  it('captures network exceptions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('socket closed')))
    const result = await sendGraphText({
      phoneNumberId: '123',
      accessToken: 'token',
      to: '5491155551234',
      text: 'Hola',
    })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('socket closed')
  })

  it('posts the expected Graph payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    await sendGraphText({
      phoneNumberId: '456',
      accessToken: 'secret-token',
      to: '5491155551234',
      text: 'Hola',
    })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('v21.0/456/messages')
    expect(init.headers.Authorization).toBe('Bearer secret-token')
    const body = JSON.parse(init.body)
    expect(body.messaging_product).toBe('whatsapp')
    expect(body.to).toBe('5491155551234')
    expect(body.text.body).toBe('Hola')
  })
})
