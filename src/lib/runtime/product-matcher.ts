import { normalizeText } from './media'
import { damerauLevenshtein } from './levenshtein'

/**
 * Product Matcher determinístico (capas de matching general, diseño aprobado).
 *
 * Complementa el nombre literal (T1) y los aliases registrados (T3, en
 * product-aliases.ts) con dos capas que eliminan la dependencia de "agregar
 * un alias a mano" por variante de escritura:
 *
 *   T2 — compacto exacto: el nombre del producto compactado (sin espacios,
 *        "Clean Nails" -> "cleannails") aparece como concatenación de 1..3
 *        tokens consecutivos del mensaje. Recupera "cleannails", "back 2 fit".
 *   T4 — fuzzy acotado: Damerau-Levenshtein <= 1 sobre el compacto, SOLO para
 *        compactos de >= 6 caracteres (espejo de la prudencia de singularStem
 *        len<4). Recupera un typo ("backfit" -> back2fit). El umbral <=1 fue
 *        validado contra TODO el catálogo (distancia mínima entre productos
 *        = 4, Neurotin <-> Neurofeet): ninguna variante de 1 edición cruza a
 *        otro producto. Subirlo a <=2 reintroduce colisiones tipo "neurofit"
 *        contra neuro* -> NO subir.
 *
 * El matcher NUNCA adivina: sin match -> sin tier -> el scope se queda como
 * vino (literal/alias/SKU o contexto heredado).
 */

export const FUZZY_MIN_COMPACT_LENGTH = 6
export const FUZZY_MAX_EDIT_DISTANCE = 1
const MAX_TOKENS = 3

export type ProductTier = 'compact' | 'fuzzy'

export interface ProductLexiconEntry {
  id: string
  compact: string
}

/** Nombre del producto compactado a solo letras/dígitos, sin espacios. */
export function compactProductName(name: string): string {
  return normalizeText(name).replace(/\s/g, '')
}

/**
 * Todas las concatenaciones de 1..MAX_TOKENS tokens consecutivos del mensaje
 * ya normalizado. Comienzan y terminan en límites de palabra por construcción,
 * de modo que el fuzzy jamás cose subcadenas dentro de un token ajeno.
 */
export function tokenConcats(normalizedMessage: string, maxTokens = MAX_TOKENS): string[] {
  const tokens = normalizedMessage.split(' ').filter(Boolean)
  const result: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    for (let k = 1; k <= maxTokens && i + k <= tokens.length; k++) {
      result.push(tokens.slice(i, i + k).join(''))
    }
  }
  return result
}

/**
 * Match T2/T4 del compacto de un producto contra el mensaje normalizado.
 * Devuelve el tier ganador, null si no hay match.
 */
export function matchCompactTiers(
  normalizedMessage: string,
  concats: string[],
  compact: string
): ProductTier | null {
  if (!compact) return null
  for (const candidate of concats) {
    if (candidate === compact) return 'compact'
  }
  if (compact.length >= FUZZY_MIN_COMPACT_LENGTH) {
    for (const candidate of concats) {
      if (
        Math.abs(candidate.length - compact.length) <= FUZZY_MAX_EDIT_DISTANCE &&
        damerauLevenshtein(candidate, compact) <= FUZZY_MAX_EDIT_DISTANCE
      ) {
        return 'fuzzy'
      }
    }
  }
  return null
}

/**
 * (b) Política conservadora — referente rival débil.
 *
 * Detecta si el mensaje menciona (con señal sub-umbral, es decir por debajo
 * de lo que muta scope) un producto del catálogo DISTINTO del scoped. Se
 * evalúa SOLO desde el scope heredado ('context'): cuando no hay explicit y
 * el turno parecería despachar la media del producto activo aunque el cliente
 * parece referirse a otro.
 *
 * Señales (conservadoras, jamás mutan scope ni claims):
 *   - un match T2/T4 exacto sobre un producto rival (defensa extra: en el
 *     branch de contexto esto no debería ocurrir, pues hubiera sido explicit);
 *   - un token de >= max(4, len(compact)-3) caracteres que es prefijo de un
 *     compacto rival (p. ej. "neuro", "byecan") o que lo cubre parcialmente.
 *     Tokens cortos/vagos como "bella" o "back" NO alcanzan el umbral y no
 *     disparan falsos positivos.
 *
 * Validado contra el catálogo real (9 productos): "cuanto cuesta", "la faja",
 * "es una bella tarde", "precio" no generan señales rivales.
 */
export function detectsDifferentProductSignal(params: {
  normalizedMessage: string
  concats: string[]
  lexicon: ProductLexiconEntry[]
  scopedProductId: string
}): boolean {
  const { normalizedMessage, concats, lexicon, scopedProductId } = params

  for (const rival of lexicon) {
    if (rival.id === scopedProductId) continue
    // Señal exacta (T2/T4) sobre un producto rival.
    if (matchCompactTiers(normalizedMessage, concats, rival.compact) !== null) return true
    // Señal débil: token que es prefijo del compacto rival con cobertura
    // suficiente (>= max(4, len-3) chars).
    const prefixFloor = Math.max(4, rival.compact.length - 3)
    for (const token of normalizedMessage.split(' ').filter(Boolean)) {
      if (token.length >= prefixFloor && rival.compact.startsWith(token)) return true
    }
  }
  return false
}