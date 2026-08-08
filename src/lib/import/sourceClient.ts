import { fetchWithRedirectSafety, readBoundedText, detectContentType, type SourceContentType } from './ssrf'
import type { RawRow, SourceMethod } from './types'
import { fetchWooCommerceProducts, type WooCommerceOptions } from './woocommerce'
import { parseFeed } from './feed'
import { scrapeHtml, type ScrapeOptions } from './scraper'

export interface FetchedSource {
  text: string
  contentType: SourceContentType
}

export async function fetchSource(url: string): Promise<FetchedSource> {
  const response = await fetchWithRedirectSafety(url)
  if (!response.ok) {
    throw new Error(`La URL respondió ${response.status} ${response.statusText}`)
  }
  const text = await readBoundedText(response)
  return { text, contentType: detectContentType(response.headers.get('content-type'), text) }
}

export interface RemoteSourceOptions {
  woocommerce?: WooCommerceOptions
  scrape?: ScrapeOptions
}

export async function fetchSourceRows(
  method: SourceMethod,
  url: string,
  options: RemoteSourceOptions = {}
): Promise<RawRow[]> {
  if (method === 'woocommerce') {
    return fetchWooCommerceProducts({ baseUrl: url, ...(options.woocommerce ?? {}) })
  }

  const source = await fetchSource(url)

  if (method === 'feed') {
    if (source.contentType !== 'xml') {
      throw new Error('La URL no devolvió un feed XML (RSS/Atom) válido')
    }
    return parseFeed(source.text)
  }

  if (method === 'scrape') {
    if (source.contentType !== 'html') {
      throw new Error('La URL no devolvió contenido HTML para extraer productos')
    }
    return scrapeHtml(source.text, options.scrape ?? {})
  }

  return []
}
