export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function triggerMatches(message: string, triggerCondition: string): boolean {
  const normalizedMessage = normalizeText(message)
  const parts = triggerCondition
    .split(',')
    .map((part) => normalizeText(part))
    .filter((part) => part.length > 0)

  return parts.some((part) => {
    const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Tolerancia a plural/singular: "envio" alcanza "envíos", "flor" alcanza "flores".
    // Se exige palabra completa (límite previo y posterior), por lo que "precio"
    // nunca alcanza "presupuesto" ni "es" alcanza "clientes".
    const pattern = new RegExp(`(?:^|\\s)${escaped}(?:s|es)?(?=\\s|$)`)
    return pattern.test(normalizedMessage)
  })
}

export function intentMatchesTrigger(intentTag: string, triggerCondition: string): boolean {
  const normalizedTag = normalizeText(intentTag)
  const parts = triggerCondition
    .split(',')
    .map((part) => normalizeText(part))
    .filter((part) => part.length > 0)

  return parts.some((part) => part === `intent ${normalizedTag}`)
}
