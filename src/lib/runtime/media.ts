export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * R1.4 — Raíz singular determinista de un keyword normalizado.
 * "fotos"→"foto", "imagenes"→"imagen", "flores"→"flor".
 * Conservadora: sin reducción para palabras cortas (<4) para no rozar
 * 'es'/'as' ni palabras cuya -s final no es marca plural de una raíz menor.
 */
function singularStem(word: string): string {
  if (word.length < 4) return word
  if (word.endsWith('es')) return word.slice(0, -2)
  if (word.endsWith('s')) return word.slice(0, -1)
  return word
}

function wordBoundaryPattern(keyword: string): string {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Tolerancia a plural/singular: "envio" alcanza "envíos", "flor" alcanza "flores".
  // Se exige palabra completa (límite previo y posterior), por lo que "precio"
  // nunca alcanza "presupuesto", "es" nunca alcanza "clientes" y "foto" nunca
  // alcanza "fotografía".
  return `(?:^|\\s)${escaped}(?:s|es)?(?=\\s|$)`
}

export function triggerMatches(message: string, triggerCondition: string): boolean {
  const normalizedMessage = normalizeText(message)
  const parts = triggerCondition
    .split(',')
    .map((part) => normalizeText(part))
    .filter((part) => part.length > 0)

  return parts.some((part) => {
    if (new RegExp(wordBoundaryPattern(part)).test(normalizedMessage)) return true
    // R1.4 bidireccional determinístico: un trigger plural alcanza su singular
    // ("fotos"→"foto", "imagenes"→"imagen") sin ampliar el catálogo de triggers.
    const stem = singularStem(part)
    if (stem === part) return false
    return new RegExp(wordBoundaryPattern(stem)).test(normalizedMessage)
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

/**
 * R2 — Intención de media (MEDIA_REQUEST) por léxico mínimo normalizado
 * (DEC-20260904 §5.2, INV-MEDIA-013, INV-MEDIA-014). Se usa para elegir el
 * "principal" (R3-P2) cuando no hay match de condición, sin depender de
 * heurísticas del catálogo. Independiente de isResendRequest (señal distinta).
 *
 * Señales (sobre texto normalizado con normalizeText):
 *   - palabra-media literal: foto(s), fotito(s), imagen(es), fotografía(s);
 *   - verbo de petición de media en forma pronominal "me": enséñame,
 *     muéstrame, mándame, pásame, envíame (con o sin pronombre la/lo adjunto).
 *
 * Exclusión deliberada (riesgo §7 de falso positivo): "ver" / "mostrar"
 * SUELTOS no activan intención; con palabra-media ya los cubre la señal
 * literal. Tampoco cuenta "me pasas/me mandas" sin palabra-media ni verbo
 * pronominal (p. ej. "pásame el teléfono").
 */
export function detectMediaIntent(message: string): boolean {
  const text = normalizeText(message)
  return (
    /\b(?:fotos?|fotitos?|imagen(?:es)?|fotografia(?:s)?)\b/.test(text) ||
    /\b(?:ensename|muestrame|mandame|pasame|enviame)\w*\b/.test(text)
  )
}

const RESEND_VERB =
  /\b(reenvia|envia|enviar|envio|envie|manda|mande|pasa|pase|muestra|mira|ver|repite|repeti|ensename|ensena)\w*\b/
const RESEND_AGAIN = /\b(otra vez|de nuevo|nuevamente)\b/
// R8 — resend pronominal explícito sin nombrar la media: "mándamela",
// "enséñamela", "muéstramela" (verbo + "me" + pronombre la/lo/las/los en el
// mismo token). NO cubre "mándala": se preserva el contrato existente
// (los tests esperan "mándalo otra vez" === false).
const RESEND_PRONOUN = /\b(ensen|muestra|manda|envia|pasa)\w*me\w*(la|lo|las|los)\b/

/**
 * Detecta una petición explícita de re-enviar la imagen ("mándala otra vez",
 * "¿me pasas la foto?", "envía la imagen de nuevo"). Se usa para saltar los
 * guards de envío único (chat_media_dispatched / media_sent_products) y
 * re-mostrar la imagen solo cuando el cliente lo pide.
 *
 * R8: además del camino con palabra-media literal, detecta resend pronominal
 * sin nombrar la media ("enséñamela de nuevo"), que no exige re-satisfacer
 * el trigger_condition del asset.
 */
export function isResendRequest(message: string): boolean {
  const text = normalizeText(message)
  const hasMediaWord = /(imagen|imagenes|foto|fotos|fotografia|fotografias)/.test(text)
  if (hasMediaWord) return RESEND_VERB.test(text) || RESEND_AGAIN.test(text)
  return RESEND_PRONOUN.test(text)
}
