import { load, contains, type Cheerio, type CheerioAPI } from 'cheerio'
import type { AnyNode } from 'domhandler'
import type { RawRow } from './types'

const CARD_CANDIDATES = [
  '[class*="product"]',
  '[class*="item"]',
  '[class*="card"]',
  '[class*="tile"]',
  '[class*="listing"]',
  '[class*="producto"]',
]

const PRICE_REGEX = /\$\s?\d[\d.,]*|\d[\d.,]*\s*(USD|MXN|EUR|ARS)\b/i

export interface ScrapeOptions {
  cardSelector?: string
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function detectCardSelector($: CheerioAPI): string | null {
  const isPriced = (element: AnyNode) => PRICE_REGEX.test($(element).text())
  let best: string | null = null
  let bestScore = 0
  for (const candidate of CARD_CANDIDATES) {
    const matched = $(candidate).toArray()
    let score = 0
    for (const element of matched) {
      if (!isPriced(element)) continue
      const containsCard = matched.some(
        (other) => other !== element && contains(element, other) && isPriced(other)
      )
      if (!containsCard) score += 1
    }
    if (score > bestScore) {
      best = candidate
      bestScore = score
    }
  }
  return bestScore > 0 ? best : null
}

function pickImageUrl($card: Cheerio<AnyNode>): string | null {
  const img = $card.find('img').first()
  const src = img.attr('src')
  const srcset = img.attr('srcset')
  if (srcset) {
    const candidates = srcset
      .split(',')
      .map((part) => part.trim().split(/\s+/))
      .filter((parts) => parts.length > 0)
      .map((parts) => ({ url: parts[0], width: parseInt(parts[1]?.replace('w', ''), 10) || 0 }))
    if (candidates.length > 0) {
      const largest = candidates.reduce((a, b) => (b.width > a.width ? b : a))
      if (largest.url) return largest.url
    }
  }
  return src ?? null
}

function extractCard($: CheerioAPI, element: AnyNode): RawRow {
  const $card = $(element)

  const name =
    collapse(
      $card
        .find('h1, h2, h3, [class*="title"], [class*="nombre"], [class*="name"], a[title]')
        .first()
        .text()
    ) || collapse($card.find('img').first().attr('alt') ?? '')

  const priceText =
    collapse(
      $card
        .find('[class*="price"], [class*="precio"], .amount, [itemprop="price"]')
        .first()
        .text()
    ) || $card.text().match(PRICE_REGEX)?.[0] || ''

  const priceMatch = priceText.match(/\d[\d.,]*/)
  const price = priceMatch ? priceMatch[0] : undefined

  const description = collapse(
    $card.find('[class*="description"], [class*="descripcion"], [class*="resumen"], p').first().text()
  )

  const imageUrl = pickImageUrl($card)

  return {
    name: name || undefined,
    price: price ?? undefined,
    description: description || undefined,
    imageUrl: imageUrl || undefined,
  }
}

export function scrapeHtml(html: string, options: ScrapeOptions = {}): RawRow[] {
  const $ = load(html)
  const cardSelector = options.cardSelector?.trim() || detectCardSelector($)
  if (!cardSelector) return []

  const isPriced = (element: AnyNode) => PRICE_REGEX.test($(element).text())
  const matches = $(cardSelector).toArray()
  const cards = matches.filter(
    (element) =>
      isPriced(element) &&
      !matches.some((other) => other !== element && contains(element, other) && isPriced(other))
  )

  const rows: RawRow[] = []
  for (const element of cards) {
    const row = extractCard($, element)
    if (row.name) rows.push(row)
  }
  return rows
}
