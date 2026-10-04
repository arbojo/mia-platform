/**
 * Guard de calidad para texto que se materializa como instruccion permanente.
 *
 * El fallo que motivo esto: siete eventos de la cosecha traian una frase textual
 * de la vendedora en `corrected_response`. Como `resolveTeachingContent()` da
 * prioridad a ese campo, "le llegaria hoy a partir de las 2 pm" se convirtió en
 * politica permanente de MIA. El approve route no lo impidió porque el texto es,
 * formalmente, una cadena válida.
 *
 * Estas reglas son baratas y sincronicas: no tocan la base, para poder usarse
 * tanto en la API como en scripts y testearse sin infraestructura.
 *
 * La comprobacion exhaustiva de "¿esto sale literalmente de una conversación?"
 * vive en `@/lib/knowledge/leakage` y necesita el corpus de mensajes. Esta es la
 * primera linea: atrapa la basura evidente antes de gastar una consulta.
 */

/**
 * Longitud mínima de una instrucción real. Las reglas de este repo rondan los
 * 150 caracteres; los fragmentos que se colaron medían 24.
 */
export const MIN_INSTRUCTION_CHARS = 40

export type InstructionCheck = { ok: true } | { ok: false; reason: string }

export function isInstructionLike(text: string | null | undefined): InstructionCheck {
  const trimmed = (text ?? '').trim()
  if (!trimmed) return { ok: false, reason: 'El texto está vacío' }

  if (trimmed.length < MIN_INSTRUCTION_CHARS) {
    return {
      ok: false,
      reason: `Demasiado corto (${trimmed.length} caracteres, mínimo ${MIN_INSTRUCTION_CHARS}). Un fragmento de conversación no es una instrucción.`,
    }
  }

  return { ok: true }
}

/** Une el resultado del guard estructural con el de la búsqueda en el corpus. */
export function toRejectionReason(
  structural: InstructionCheck,
  transcriptMatch: boolean,
): string | null {
  if (!structural.ok) return structural.reason
  if (transcriptMatch) {
    return 'El texto aparece literalmente en una conversación de WhatsApp. No es una instrucción: es un fragmento de una conversación que alguien convirtió en política.'
  }
  return null
}