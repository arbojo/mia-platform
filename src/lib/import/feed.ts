import { XMLParser } from 'fast-xml-parser'
import type { RawRow } from './types'

type XmlNode = string | number | { '#text'?: string | number; [key: string]: unknown } | null

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function extractText(node: XmlNode | XmlNode[] | undefined): string | undefined {
  if (node === undefined || node === null) return undefined
  if (Array.isArray(node)) {
    const values = node.map(extractText).filter((v): v is string => v !== undefined)
    return values.length > 0 ? values[0] : undefined
  }
  if (typeof node === 'string' || typeof node === 'number') return String(node).trim() || undefined
  if (typeof node === 'object') {
    const text = node['#text']
    if (text !== undefined && text !== null) return String(text).trim() || undefined
  }
  return undefined
}

function readAttribute(node: XmlNode, key: string): string | undefined {
  if (typeof node !== 'object' || node === null) return undefined
  const value = node[key]
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return undefined
}

function findItemName(item: Record<string, unknown>): string | undefined {
  const candidates = ['title', 'name', 'nombre', 'product_name', 'productName']
  for (const key of candidates) {
    const value = extractText(item[key] as XmlNode)
    if (value) return value
  }
  return undefined
}

function findItemSku(item: Record<string, unknown>): string | undefined {
  const candidates = ['sku', 'g:id', 'mpn', 'id', 'sku_venta']
  for (const key of candidates) {
    const value = extractText(item[key] as XmlNode)
    if (value) return value
  }
  return undefined
}

function findItemPrice(item: Record<string, unknown>): string | undefined {
  const candidates = ['price', 'g:price', 'woocommerce:price', 'sale_price', 'amount', 'precio']
  for (const key of candidates) {
    const value = extractText(item[key] as XmlNode)
    if (value !== undefined) return value.replace(/[^0-9.,]/g, '') || undefined
  }
  return undefined
}

function findItemDescription(item: Record<string, unknown>): string | undefined {
  const candidates = ['g:description', 'description', 'content', 'summary']
  for (const key of candidates) {
    const value = extractText(item[key] as XmlNode)
    if (value) return value
  }
  return undefined
}

function findItemImage(item: Record<string, unknown>): string | undefined {
  const candidates = ['g:image_link', 'image_link', 'image', 'url', 'thumbnail_url']
  for (const key of candidates) {
    const value = extractText(item[key] as XmlNode)
    if (value) return value
  }

  for (const key of ['media:content', 'media:thumbnail', 'enclosure']) {
    const node = item[key] as XmlNode
    const url = readAttribute(node, '@_url')
    if (url) return url
  }

  const link = item['link'] as XmlNode
  if (typeof link === 'object' && link !== null) {
    const rel = readAttribute(link, '@_rel')
    const href = readAttribute(link, '@_href')
    if ((rel === 'enclosure' || rel === undefined) && href) return href
  }

  return undefined
}

function findItems(root: Record<string, unknown>): Record<string, unknown>[] {
  const rss = root['rss'] as Record<string, unknown> | undefined
  if (rss) {
    const channel = rss['channel'] as Record<string, unknown> | undefined
    return asArray<Record<string, unknown>>(channel?.item as Record<string, unknown>)
  }

  const feed = root['feed'] as Record<string, unknown> | undefined
  if (feed) {
    return asArray<Record<string, unknown>>(feed.entry as Record<string, unknown>)
  }

  for (const rootKey of ['products', 'catalog', 'items', 'root']) {
    const node = root[rootKey] as Record<string, unknown> | undefined
    if (node) {
      for (const key of ['product', 'producto', 'item', 'product_item']) {
        const items = node[key]
        if (items !== undefined && items !== null) {
          return asArray<Record<string, unknown>>(items as Record<string, unknown>)
        }
      }
    }
  }

  return []
}

export function parseFeed(xml: string): RawRow[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
  })

  const parsed = parser.parse(xml) as Record<string, unknown>
  const items = findItems(parsed)

  const rows: RawRow[] = []
  for (const item of items) {
    const row: RawRow = {
      name: findItemName(item),
      sku: findItemSku(item),
      price: findItemPrice(item),
      description: findItemDescription(item),
      imageUrl: findItemImage(item),
    }
    if (row.name) rows.push(row)
  }
  return rows
}
