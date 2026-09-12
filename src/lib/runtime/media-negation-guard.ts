import { normalizeText } from './media'

export interface MediaDenialRepair {
  text: string
  corrected: boolean
  matched: string[]
}

const MEDIA_NOUNS = '(?:imagen|imagenes|foto|fotos|fotografia|fotografias)'
const NO_PREFIX = '(?:(?:aun|todavia)\\s+)?no\\s+'
const LACK_VERBS =
  '(?:tengo|tenemos|tenia|teniamos|poseo|poseemos|dispongo|disponemos|manejo|manejamos|cuento|contamos)'
const SEND_VERBS = '(?:enviar|mandar|compartir|mostrar|ensenar)'
const ART =
  '(?:\\s+(?:de|con))?(?:\\s+(?:la|las|una|unas|ninguna|esa|esta|otras))?'

const DENIAL_RE = new RegExp(
  [
    `${NO_PREFIX}${LACK_VERBS}\\b${ART}\\s+${MEDIA_NOUNS}\\b`,
    `\\bno\\s+(?:te\\s+)?(?:puedo|podemos)\\s+${SEND_VERBS}(?:te|le)?\\b${ART}\\s+${MEDIA_NOUNS}\\b`,
    `\\bno\\s+hay\\s+(?:imagen|imagenes|foto|fotos)\\b`,
  ].join('|'),
  'g'
)

// Límite de oración: ". " (con espacio/trailing) o salto de línea. Excluye
// "..." y decimales (no van seguidos de espacio) y respeta la ¡! interior
// del español (no divide "¡aquí estoy!").
const SENTENCE_BOUNDARY = /(?<!\.)\.\s|\r?\n/g

function splitSegments(text: string): string[] {
  const out: string[] = []
  let cursor = 0
  let m: RegExpExecArray | null = null
  while ((m = SENTENCE_BOUNDARY.exec(text))) {
    const cut = m.index + m[0].length
    out.push(text.slice(cursor, cut))
    cursor = cut
  }
  if (cursor < text.length) out.push(text.slice(cursor))
  if (out.length === 0 && text.length > 0) out.push(text)
  return out
}

function deniesMedia(segment: string): string[] {
  const trimmed = segment.trim()
  // Las preguntas ("¿por qué no tengo imágenes?") no son negaciones del LLM.
  if (trimmed.endsWith('?')) return []
  const normalized = normalizeText(trimmed)
  if (!normalized) return []
  const found: string[] = []
  DENIAL_RE.lastIndex = 0
  let m: RegExpExecArray | null = null
  while ((m = DENIAL_RE.exec(normalized))) found.push(m[0])
  return found
}

/**
 * Guard determinístico anti-negación de imagen (capa ADICIONAL al prompt
 * truthful, no reemplazo). Solo debe invocarse cuando el runtime ya decidió
 * DESPACHAR la imagen en el turno (safeMedia/dispatched=true). Si el modelo
 * niega la imagen de todos modos, se elimina la oración negadora y se
 * conserva el resto del turno; si la negación abarca todo el texto, se
 * reemplaza por la plantilla de entrega. Cero latencia extra (sin llamada
 * al LLM).
 */
export function repairMediaDenial(
  text: string,
  options?: { productName?: string | null }
): MediaDenialRepair {
  if (!text.trim()) return { text, corrected: false, matched: [] }

  const kept: string[] = []
  const matched: string[] = []
  for (const seg of splitSegments(text)) {
    const hit = deniesMedia(seg)
    if (hit.length > 0) matched.push(...hit)
    else kept.push(seg)
  }

  if (matched.length === 0) return { text, corrected: false, matched: [] }

  const repaired = kept.join('').trim()
  if (!repaired) {
    const product = options?.productName?.trim()
    return {
      text: product ? `Aquí tienes la imagen de ${product}.` : 'Aquí tienes la imagen.',
      corrected: true,
      matched,
    }
  }
  return { text: repaired, corrected: true, matched }
}