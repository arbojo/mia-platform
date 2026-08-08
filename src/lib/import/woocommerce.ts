import { load } from 'cheerio'
import type { RawRow } from './types'
import { fetchWithRedirectSafety, readBoundedText } from './ssrf'

export interface WooCommerceOptions {
  baseUrl: string
  consumerKey?: string
  consumerSecret?: string
}

const MAX_PAGES = 5

function stripHtml(html: string | undefined): string | undefined {
  if (!html) return undefined
  const text = load(html).text().replace(/\s+/g, ' ').trim()
  return text || undefined
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  const withWpJson = trimmed.includes('/wp-json/') ? trimmed : `${trimmed}/wp-json`
  return withWpJson
}

function buildProductsUrl(options: WooCommerceOptions, page: number): URL {
  const base = normalizeBaseUrl(options.baseUrl)
  const storeApi = `${base}/wc/store/v1/products`
  const v3Api = `${base}/wc/v3/products`

  const params = new URLSearchParams({ per_page: '100', page: String(page) })
  if (options.consumerKey && options.consumerSecret) {
    params.set('consumer_key', options.consumerKey)
    params.set('consumer_secret', options.consumerSecret)
  }
  return new URL(`${options.consumerKey ? v3Api : storeApi}?${params.toString()}`)
}

interface WooProduct {
  name?: string
  sku?: string
  price?: string
  regular_price?: string
  short_description?: string
  description?: string
  images?: { src?: string }[]
  prices?: { price?: string; regular_price?: string }
}

function mapProduct(product: WooProduct): RawRow {
  const price = product.price ?? product.regular_price ?? product.prices?.price ?? product.prices?.regular_price
  return {
    name: product.name?.trim() || undefined,
    sku: product.sku?.trim() || undefined,
    price: price ? price.replace(/[^0-9.,]/g, '') || undefined : undefined,
    benefits: stripHtml(product.short_description),
    description: stripHtml(product.description),
    imageUrl: product.images?.[0]?.src || undefined,
  }
}

export async function fetchWooCommerceProducts(options: WooCommerceOptions): Promise<RawRow[]> {
  const rows: RawRow[] = []
  let totalPages = 1

  for (let page = 1; page <= Math.min(totalPages, MAX_PAGES); page++) {
    const url = buildProductsUrl(options, page)
    const response = await fetchWithRedirectSafety(url.toString())

    if (!response.ok) {
      throw new Error(`WooCommerce respondió ${response.status} ${response.statusText}`)
    }

    const totalHeader = response.headers.get('x-wp-totalpages')
    if (totalHeader) {
      const parsed = parseInt(totalHeader, 10)
      if (!Number.isNaN(parsed)) totalPages = parsed
    }

    const body = await readBoundedText(response)
    let products: WooProduct[]
    try {
      products = JSON.parse(body) as WooProduct[]
    } catch {
      throw new Error('La respuesta de WooCommerce no es JSON válido')
    }

    for (const product of products) {
      const row = mapProduct(product)
      if (row.name) rows.push(row)
    }

    if (products.length === 0) break
  }

  return rows
}
