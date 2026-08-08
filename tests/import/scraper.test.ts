import { describe, it, expect } from 'vitest'
import { scrapeHtml, detectCardSelector } from '@/lib/import/scraper'
import { load } from 'cheerio'

const SAMPLE_HTML = `
<div class="product-list">
  <div class="product-card">
    <img src="https://cdn.example.com/zapatos.jpg" alt="Zapatos XYZ">
    <h3 class="product-title">Zapatos XYZ</h3>
    <span class="price">$25.50</span>
    <p class="description">Cómodos y resistentes</p>
  </div>
  <div class="product-card">
    <img src="https://cdn.example.com/camisa.jpg" alt="Camisa Lino">
    <h3 class="product-title">Camisa Lino</h3>
    <span class="price">$19.00</span>
  </div>
</div>
`

describe('detectCardSelector', () => {
  it('elige el selector de tarjetas ignorando contenedores', () => {
    const $ = load(SAMPLE_HTML)
    const selector = detectCardSelector($)
    expect(selector).toBe('[class*="product"]')
    expect($(selector!).length).toBeGreaterThan(0)
  })
})

describe('scrapeHtml', () => {
  it('extrae productos con nombre, precio, descripción e imagen', () => {
    const rows = scrapeHtml(SAMPLE_HTML)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      name: 'Zapatos XYZ',
      price: '25.50',
      description: 'Cómodos y resistentes',
      imageUrl: 'https://cdn.example.com/zapatos.jpg',
    })
    expect(rows[1]).toMatchObject({ name: 'Camisa Lino', price: '19.00' })
  })

  it('usa el selector CSS explícito', () => {
    const rows = scrapeHtml(SAMPLE_HTML, { cardSelector: '.product-card' })
    expect(rows).toHaveLength(2)
    expect(rows[0].name).toBe('Zapatos XYZ')
  })

  it('prioriza srcset sobre src en imágenes', () => {
    const html = `
      <div class="product-card">
        <h2 class="title">Test</h2>
        <img src="small.jpg" srcset="small.jpg 300w, large.jpg 1200w" alt="Test">
        <span class="price">$9.99</span>
      </div>
    `
    const rows = scrapeHtml(html)
    expect(rows[0].imageUrl).toBe('large.jpg')
  })

  it('devuelve array vacío sin tarjetas con precio', () => {
    expect(scrapeHtml('<html><body><p>No hay productos</p></body></html>')).toEqual([])
  })
})
