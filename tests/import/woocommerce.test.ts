import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(() => [{ address: '93.184.216.34', family: 4 }]),
}))

import { fetchWooCommerceProducts } from '@/lib/import/woocommerce'
import { fakeResponse } from './fixtures'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

describe('fetchWooCommerceProducts', () => {
  it('mapea productos de la Store API pública', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(
      fakeResponse(
        JSON.stringify([
          {
            name: 'Perfume',
            sku: 'PER-1',
            prices: { price: '25.50', regular_price: '30.00' },
            short_description: '<p>Ideal para regalar.</p>',
            description: '<p>Fragancia fresca.</p>',
            images: [{ src: 'https://cdn.example.com/perfume.jpg' }],
          },
        ]),
        'application/json',
        200,
        { 'x-wp-totalpages': '1' }
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    const rows = await fetchWooCommerceProducts({ baseUrl: 'https://shop.example.com' })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      name: 'Perfume',
      sku: 'PER-1',
      price: '25.50',
      benefits: 'Ideal para regalar.',
      description: 'Fragancia fresca.',
      imageUrl: 'https://cdn.example.com/perfume.jpg',
    })
    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toContain('/wp-json/wc/store/v1/products')
  })

  it('usa la API v3 con credenciales', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(fakeResponse('[]', 'application/json', 200))
    vi.stubGlobal('fetch', fetchMock)

    await fetchWooCommerceProducts({
      baseUrl: 'https://shop.example.com',
      consumerKey: 'ck_test',
      consumerSecret: 'cs_test',
    })
    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toContain('/wp-json/wc/v3/products')
    expect(calledUrl).toContain('consumer_key=ck_test')
    expect(calledUrl).toContain('consumer_secret=cs_test')
  })

  it('respeta la paginación por X-WP-TotalPages', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(
      fakeResponse(JSON.stringify([{ name: 'A', sku: 'A-1' }]), 'application/json', 200, { 'x-wp-totalpages': '2' })
    )
    fetchMock.mockResolvedValueOnce(
      fakeResponse(JSON.stringify([{ name: 'B', sku: 'B-1' }]), 'application/json', 200, { 'x-wp-totalpages': '2' })
    )
    vi.stubGlobal('fetch', fetchMock)

    const rows = await fetchWooCommerceProducts({ baseUrl: 'https://shop.example.com' })
    expect(rows).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('lanza error cuando la API responde fallo', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(fakeResponse('unauthorized', 'text/plain', 401))))
    await expect(fetchWooCommerceProducts({ baseUrl: 'https://shop.example.com' })).rejects.toThrow(
      'WooCommerce respondió 401'
    )
  })

  it('lanza error con respuesta no JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(fakeResponse('<html>no</html>', 'text/html', 200))))
    await expect(fetchWooCommerceProducts({ baseUrl: 'https://shop.example.com' })).rejects.toThrow(
      'no es JSON válido'
    )
  })
})
