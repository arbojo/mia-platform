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

const RESEND_VERB =
  /\b(reenvia|envia|enviar|envio|envie|manda|mande|pasa|pase|muestra|mira|ver|repite|repeti|ensename|ensena)\w*\b/
const RESEND_AGAIN = /\b(otra vez|de nuevo|nuevamente)\b/

/**
 * Detecta una petición explícita de re-enviar la imagen ("mándala otra vez",
 * "¿me pasas la foto?", "envía la imagen de nuevo"). Se usa para saltar los
 * guards de envío único (chat_media_dispatched / media_sent_products) y
 * re-mostrar la imagen solo cuando el cliente lo pide.
 */
export function isResendRequest(message: string): boolean {
  const text = normalizeText(message)
  const hasMediaWord = /(imagen|imagenes|foto|fotos|fotografia|fotografias)/.test(text)
  if (!hasMediaWord) return false
  return RESEND_VERB.test(text) || RESEND_AGAIN.test(text)
}
