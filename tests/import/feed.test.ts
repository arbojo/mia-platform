import { describe, it, expect } from 'vitest'
import { parseFeed } from '@/lib/import/feed'

const RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Mi Tienda</title>
    <item>
      <title>Zapatos XYZ</title>
      <g:id>ZAP-001</g:id>
      <g:price>25.50 USD</g:price>
      <g:image_link>https://cdn.example.com/zapatos.jpg</g:image_link>
      <description><![CDATA[<p>Cómodos y resistentes.</p>]]></description>
    </item>
    <item>
      <title>Camisa Lino</title>
      <g:id>CAM-002</g:id>
      <g:price>19.99 USD</g:price>
      <media:content url="https://cdn.example.com/camisa.jpg" />
    </item>
  </channel>
</rss>`

const ATOM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Catálogo</title>
  <entry>
    <title>Producto A</title>
    <id>SKU-100</id>
    <summary>Resumen del producto</summary>
    <link href="https://cdn.example.com/a.jpg" rel="enclosure"/>
  </entry>
</feed>`

const GENERIC_XML = `<?xml version="1.0"?>
<products>
  <product>
    <name>Perfume</name>
    <sku>PER-1</sku>
    <price>45</price>
  </product>
  <product>
    <name>Crema</name>
    <sku>CRE-2</sku>
    <price>18.5</price>
  </product>
</products>`

describe('parseFeed', () => {
  it('parsea RSS con namespaces Google Shopping', () => {
    const rows = parseFeed(RSS_XML)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      name: 'Zapatos XYZ',
      sku: 'ZAP-001',
      price: '25.50',
      imageUrl: 'https://cdn.example.com/zapatos.jpg',
      description: '<p>Cómodos y resistentes.</p>',
    })
    expect(rows[1]).toMatchObject({ name: 'Camisa Lino', sku: 'CAM-002', imageUrl: 'https://cdn.example.com/camisa.jpg' })
  })

  it('parsea Atom con link enclosure', () => {
    const rows = parseFeed(ATOM_XML)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      name: 'Producto A',
      sku: 'SKU-100',
      description: 'Resumen del producto',
      imageUrl: 'https://cdn.example.com/a.jpg',
    })
  })

  it('parsea XML genérico de productos', () => {
    const rows = parseFeed(GENERIC_XML)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ name: 'Perfume', sku: 'PER-1', price: '45' })
    expect(rows[1]).toMatchObject({ name: 'Crema', price: '18.5' })
  })

  it('devuelve array vacío sin items', () => {
    expect(parseFeed('<rss><channel><title>Vacío</title></channel></rss>')).toEqual([])
  })
})
