/**
 * Human takeover — pure decision helpers.
 *
 * A business-side human replying in a conversation pauses MIA for THAT
 * conversation (see conversations.ai_paused_at). The `#e` command toggles the
 * state. All persistence lives in the runtime; the decisions are kept here so
 * they are unit-testable without a database.
 */

export function isHumanTakeoverEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.HUMAN_TAKEOVER_ENABLED !== '0'
}

/**
 * Mensaje de recuperación de Vitanova. Cuando un humano del negocio lo envía
 * (broadcast manual desde el número), MIA se retoma automáticamente: se limpia
 * `conversations.ai_paused_at` y la IA responde al siguiente mensaje del
 * cliente. Es el ÚNICO texto humano que no pausa.
 *
 * Si el negocio cambia el copy del mensaje, actualizar esta constante.
 */
const RECOVERY_RESUME_MESSAGE = [
  '👋 Hola, ¿aún sigues interesado? 😍',
  '🚚 Aprovecha que  el envío es totalmente GRATIS',
  '💵 Pagas al recibir, sin riesgos',
  '⚠️ ¡Últimas piezas disponibles!',
  '',
  '✨ Aprovecha y agenda tu pedido HOY mismo antes de que se terminen 🙌💜',
  '',
  'https://mia-platform-psi.vercel.app/catalogo',
].join('\n')

/**
 * Normalización para la comparación de la plantilla de recuperación.
 * Tolera diferencias de formato que no cambian el mensaje: mayúsculas,
 * acentos, emojis, espacios de más y saltos de línea. Conserva el texto (y el
 * dominio del enlace) para que un mensaje distinto NO coincida.
 */
export function normalizeForRecoveryMatch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
}

/** Match estricto: el mensaje humano debe ser exactamente la recuperación. */
export function isRecoveryResumeMessage(content: string): boolean {
  return normalizeForRecoveryMatch(content) === normalizeForRecoveryMatch(RECOVERY_RESUME_MESSAGE)
}

/**
 * The value `conversations.ai_paused_at` must be set to for a human outbound.
 * `toggle` flips the current state (pause <-> resume); a plain message always
 * pauses (refreshing the instant while the human keeps writing).
 */
export function nextAiPausedAt(
  command: 'toggle' | undefined,
  currentAiPausedAt: string | null,
  now: string = new Date().toISOString()
): string | null {
  if (command === 'toggle') {
    return currentAiPausedAt ? null : now
  }
  return now
}

/**
 * Whether an inbound CUSTOMER message must be swallowed (persisted for context
 * but never answered) because a human currently owns the conversation.
 */
export function shouldStaySilentForHumanTakeover(
  enabled: boolean,
  aiPausedAt: string | null | undefined
): boolean {
  return enabled && Boolean(aiPausedAt)
}

/**
 * Decisión de pausa para un mensaje saliente del HUMANO (vendedora).
 *
 *  - `toggle` (#e): invierte el estado actual (pausa <-> retoma).
 *  - mensaje de recuperación: retoma siempre (null), para que la IA responda
 *    al siguiente mensaje del cliente.
 *  - cualquier otro mensaje humano: pausa (y refresca la pausa mientras
 *    la vendedora sigue escribiendo).
 */
export function decideOutboundPauseState(params: {
  command?: 'toggle'
  content: string
  currentAiPausedAt: string | null
  now?: string
}): string | null {
  const now = params.now ?? new Date().toISOString()
  if (params.command === 'toggle') {
    return nextAiPausedAt('toggle', params.currentAiPausedAt, now)
  }
  if (isRecoveryResumeMessage(params.content)) {
    return null
  }
  return now
}
