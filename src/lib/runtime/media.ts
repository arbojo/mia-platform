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
    const pattern = new RegExp(`(?:^|\\s)${escaped}(?=\\s|$)`)
    return pattern.test(normalizedMessage)
  })
}
