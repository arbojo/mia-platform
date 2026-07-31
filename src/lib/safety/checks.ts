import type { SafetyContext } from './types'

const AMOUNT_PATTERN = /(\d[\d,.]*)/g

export function validatePrice(
  text: string,
  context: SafetyContext
): { valid: boolean; reason?: string } {
  if (context.products.length === 0) {
    return { valid: false, reason: 'No hay productos registrados para verificar precios' }
  }

  const amounts = extractAmounts(text)
  if (amounts.length === 0) return { valid: true }

  const validPrices = new Set(context.products.map((p) => p.price).filter((p): p is number => p !== null))

  for (const amount of amounts) {
    if (amount > 0 && validPrices.size > 0) {
      if (!isCloseToAny(amount, [...validPrices])) {
        return { valid: false, reason: `Precio $${amount} no coincide con productos registrados` }
      }
    }
  }

  return { valid: true }
}

export function validateDelivery(
  text: string,
  context: SafetyContext
): { valid: boolean; reason?: string } {
  const deliveryRule = context.rules.find(
    (r) => r.category === 'zones' || r.category === 'schedule'
  )
  if (!deliveryRule) return { valid: true }

  const dayMatch = text.match(/(\d+)\s*(?:d[ií]a)/i)
  if (dayMatch) {
    const claimedDays = parseInt(dayMatch[1], 10)

    const ruleDays = extractDaysFromRule(deliveryRule.content)
    if (ruleDays !== null && claimedDays < ruleDays) {
      return {
        valid: false,
        reason: `Tiempo de entrega ${claimedDays} días no coincide con regla (${ruleDays} días)`,
      }
    }
  }

  const relativeMatch = text.match(/\b(mañana|hoy|este\s*\w+)\b/i)
  if (relativeMatch) {
    const ruleDays = extractDaysFromRule(deliveryRule.content)
    if (ruleDays !== null && ruleDays > 1) {
      return {
        valid: false,
        reason: `Entrega prometida para "${relativeMatch[1]}" no es posible según regla (${ruleDays} días)`,
      }
    }
  }

  return { valid: true }
}

export function validateGuarantee(
  text: string,
  context: SafetyContext
): { valid: boolean; reason?: string } {
  const guaranteeRule = context.rules.find(
    (r) => r.category === 'restrictions'
  )
  if (!guaranteeRule) return { valid: true }

  const lowerText = text.toLowerCase()
  const lowerRule = guaranteeRule.content.toLowerCase()

  const ruleExcludesReturns = /no\s+(aceptamos|hacemos|recibimos|permitimos).*(?:devoluci[oó]n|reembolso|cambio)/i.test(lowerRule)
  if (ruleExcludesReturns) {
    if (/devoluci[oó]n|reembolso/i.test(lowerText) && !/no\s+(aceptamos|hacemos)/i.test(lowerText)) {
      return { valid: false, reason: 'El negocio no acepta devoluciones' }
    }
  }

  const daysMatch = text.match(/(\d+)\s*(?:d[ií]a)/i)
  if (daysMatch) {
    const claimedDays = parseInt(daysMatch[1], 10)

    const ruleDays = extractDaysFromRule(guaranteeRule.content)
    if (ruleDays !== null && claimedDays > ruleDays) {
      return {
        valid: false,
        reason: `Plazo de garantía/devolución ${claimedDays} días excede lo permitido (${ruleDays} días)`,
      }
    }
  }

  return { valid: true }
}

export function validateDiscount(
  text: string,
  context: SafetyContext
): { valid: boolean; reason?: string } {
  const promoRule = context.rules.find(
    (r) => r.category === 'promotions'
  )
  if (!promoRule) return { valid: true }

  const pctMatch = text.match(/(\d+)\s*%/i)
  if (pctMatch) {
    const claimedPct = parseInt(pctMatch[1], 10)
    const maxDiscount = extractMaxDiscount(promoRule.content)
    if (maxDiscount !== null && claimedPct > maxDiscount) {
      return {
        valid: false,
        reason: `Descuento ${claimedPct}% excede máximo permitido (${maxDiscount}%)`,
      }
    }
  }

  return { valid: true }
}

export function validateImmutable(
  text: string,
  context: SafetyContext
): { valid: boolean; reason?: string } {
  const immutables = context.memory.filter((m) => m.is_immutable)
  if (immutables.length === 0) return { valid: true }

  const lowerText = text.toLowerCase()

  for (const mem of immutables) {
    const lowerContent = mem.content.toLowerCase()
    if (lowerContent.includes('no ') || lowerContent.includes('nunca') || lowerContent.includes('sin')) {
      const negation = extractKeyPhrase(lowerContent)
      if (negation) {
        const contradicts = checkContradiction(lowerText, lowerContent)
        if (contradicts) {
          return { valid: false, reason: `Respuesta contradice regla inmutable: ${mem.content.slice(0, 100)}` }
        }
      }
    }
  }

  return { valid: true }
}

function extractAmounts(text: string): number[] {
  const amounts: number[] = []
  const matches = text.matchAll(AMOUNT_PATTERN)
  for (const match of matches) {
    const cleaned = parseFloat(match[1].replace(/,/g, ''))
    if (!isNaN(cleaned)) amounts.push(cleaned)
  }
  return amounts
}

function isCloseToAny(value: number, validValues: number[]): boolean {
  return validValues.some((v) => Math.abs(v - value) < 0.01)
}

function extractDaysFromRule(content: string): number | null {
  const match = content.match(/(\d+)\s*(?:d[ií]a)/i)
  return match ? parseInt(match[1], 10) : null
}

function extractMaxDiscount(content: string): number | null {
  const match = content.match(/(\d+)\s*%/i)
  return match ? parseInt(match[1], 10) : null
}

function extractKeyPhrase(content: string): string | null {
  const noMatch = content.match(/(?:no|nunca|sin)\s+\w+(?:\s+\w+){0,3}/i)
  return noMatch ? noMatch[0] : null
}

function checkContradiction(lowerText: string, lowerContent: string): boolean {
  const negationPattern = /(?:no|nunca|sin)\s+\w+/gi
  const textNegations = lowerText.match(negationPattern) ?? []
  const contentNegations = lowerContent.match(negationPattern) ?? []

  for (const contentNeg of contentNegations) {
    for (const textNeg of textNegations) {
      if (textNeg.includes(contentNeg)) return false
    }
  }

  const positiveAssertions = lowerText.match(/(?:s[ií]|claro|puedo|ofrecemos|tenemos)\s+\w+/gi) ?? []
  const contentNegations2 = lowerContent.match(/(?:no|nunca)\s+\w+(?:\s+\w+){0,2}/gi) ?? []

  for (const pos of positiveAssertions) {
    for (const neg of contentNegations2) {
      const keyword = neg.replace(/no |nunca /, '').trim().slice(0, 20)
      if (keyword && pos.includes(keyword)) return true
    }
  }

  const contentNegMatch = lowerContent.match(/(?:no|nunca|sin)\s+(\w+(?:\s+\w+){1,3})/i)
  if (contentNegMatch) {
    const negWords = contentNegMatch[1].split(/\s+/).filter((w) => w.length > 3)
    const textHasNegation = /(?:no|nunca|sin)\b/i.test(lowerText)
    const matchingWords = negWords.filter((w) => lowerText.includes(w))
    if (!textHasNegation && matchingWords.length >= 2) {
      return true
    }
    if (!textHasNegation && matchingWords.length === 1 && negWords.length <= 2) {
      return true
    }
  }

  return false
}
