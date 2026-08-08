import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(() => [{ address: '93.184.216.34', family: 4 }]),
}))

import { fetchSourceRows, fetchSource } from '@/lib/import/sourceClient'
import { fakeResponse } from './fixtures'

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><item><title>Producto</title><price>10</price></item></channel></rss>`
const HTML = `
<div class="product-card">
  <h2 class="title">Camisa</h2>
  <span class="price">$15.00</span>
</div>
`

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

describe('fetchSource', () => {
  it('devuelve texto y tipo de contenido', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(fakeResponse(RSS, 'application/rss+xml')))
    )
    const source = await fetchSource('https://example.com/feed.xml')
    expect(source.contentType).toBe('xml')
    expect(source.text).toContain('<rss')
  })

  it('lanza error con respuesta de error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(fakeResponse('nope', 'text/plain', 404))))
    await expect(fetchSource('https://example.com/missing')).rejects.toThrow('404')
  })
})

describe('fetchSourceRows', () => {
  it('parsea feeds XML', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(fakeResponse(RSS, 'application/rss+xml'))))
    const rows = await fetchSourceRows('feed', 'https://example.com/feed.xml')
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Producto')
  })

  it('rechaza feeds que no son XML', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(fakeResponse('{"a":1}', 'application/json'))))
    await expect(fetchSourceRows('feed', 'https://example.com/feed.json')).rejects.toThrow('feed XML')
  })

  it('extrae productos de HTML', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(fakeResponse(HTML, 'text/html'))))
    const rows = await fetchSourceRows('scrape', 'https://example.com/tienda')
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Camisa')
  })

  it('rechaza scraping de contenido no HTML', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(fakeResponse(RSS, 'application/rss+xml'))))
    await expect(fetchSourceRows('scrape', 'https://example.com/feed.xml')).rejects.toThrow('HTML')
  })

  it('delega a WooCommerce con las credenciales', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(fakeResponse(JSON.stringify([{ name: 'Perfume', sku: 'PER-1' }]), 'application/json'))
    vi.stubGlobal('fetch', fetchMock)
    const rows = await fetchSourceRows('woocommerce', 'https://shop.example.com', {
      woocommerce: { baseUrl: 'https://shop.example.com', consumerKey: 'ck', consumerSecret: 'cs' },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Perfume')
  })
})
