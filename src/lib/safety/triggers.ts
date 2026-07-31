import type { SafetyTrigger } from './types'

const PRICE_PATTERN = /(?:\$|cuesta|precio|price|cost[so]|valor)\s*:?\s*[\d,.]+/gi
const DELIVERY_PATTERN = /(?:llega(?:r[aá])?|entrega|enviamos|env[ií]o|llegada|tarda|demora)\s*.*?(\d+\s*d[ií]a)?/gi
const GUARANTEE_PATTERN = /(?:garant[ií]a|devoluci[oó]n|devolver|reembolso|cancelaci[oó]n)/gi
const DISCOUNT_PATTERN = /(?:descuento|promoci[oó]n|oferta|rebaja|%(?:\s*de)?\s*(?:descuento|off)?)/gi

export function scanTriggers(text: string): SafetyTrigger[] {
  if (!text) return []

  const seen = new Set<string>()
  const triggers: SafetyTrigger[] = []

  const scan = (type: SafetyTrigger['type'], pattern: RegExp) => {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      const key = `${type}:${match[0]}`
      if (!seen.has(key)) {
        seen.add(key)
        triggers.push({ type, text: match[0].slice(0, 60), confidence: 'high' })
      }
    }
  }

  scan('price', PRICE_PATTERN)
  scan('delivery', DELIVERY_PATTERN)
  scan('guarantee', GUARANTEE_PATTERN)
  scan('discount', DISCOUNT_PATTERN)

  return triggers
}
