import { executeAI } from './execute-ai'
import { findSafetyViolations } from './safety-guard'

/**
 * Humanizador de respuestas. Un segundo paso, opt-in y APENAS para respuestas a
 * clientes reales (`live_customer`), que reescribe el borrador final con tono
 * natural de WhatsApp. Corre DESPUÉS del guard de seguridad (executeAI) y ANTES
 * de persistir/enviar: lo que ve el cliente es lo humanizado, y el texto
 * persistido también lo es.
 *
 * Por qué un paso separado y no solo el prompt: el guard correctivo produce
 * esqueletos de frase repetidos ("Entiendo que ya conoces tu situación… ¿Te
 * gustaría hacer un pedido?"). Un rewrite corto le devuelve la variación sin
 * tocar la corrección de seguridad.
 *
 * Blindaje: la reescritura nunca puede violar la seguridad. Si la reescritura
 * reintroduce un claim o una derivación (findSafetyViolations), se descarta y se
 * usa el borrador original. Tampoco reescribe respuestas triviales (<30 chars)
 * ni textos vacíos.
 *
 * El call site (core.ts) decide CUÁNDO humanizar: este módulo no conoce entornos
 * ni flags; recibe siempre un reply y devuelve el mejor texto.
 */
export const MIN_REPLY_LENGTH = 30
const MAX_TOKENS = 240
const TEMPERATURE = 0.9

const HUMANIZER_SYSTEM = [
  'Sos MIA, la vendedora por WhatsApp de Vitanova.',
  'Reescribís en español el borrador de una respuesta para que suene como la escribiría una vendedora real: cálida, natural y conversacional, sin plantillas, sin listados mecánicos ni frases repetidas.',
  'Reglas innegociables:',
  '- Conservá TODO dato del borrador: producto, precio, cantidad, forma de uso, envío y garantías.',
  '- Si el borrador aclara que no es un tratamiento médico, mantené esa aclaración textualmente.',
  '- No agregues datos, beneficios ni condiciones que no estén en el borrador.',
  '- No hagas recomendaciones médicas, no afirmes que cura, previene o trata, y no sugieras consultar a un médico o profesional.',
  '- Variá la pregunta o el cierre de venta para que no suene mecánico.',
  '- Mantené un largo similar al borrador: como máximo dos párrafos cortos.',
  '- Respondé SOLO con el texto reescrito: sin comillas, sin prefacios y sin título.',
].join('\n')

export function buildHumanizePrompt(reply: string, customerText: string): string {
  const context = customerText.trim()
    ? `Lo que escribió el cliente (contexto, no reescribir):\n${customerText.trim()}`
    : ''
  return [context, `Borrador de la respuesta a reescribir:\n${reply}`].filter(Boolean).join('\n\n')
}

export async function humanizeReply(params: {
  reply: string
  customerText: string
  businessId: string
  assistantId: string
  requestType: string
}): Promise<string> {
  const trimmed = params.reply.trim()
  if (trimmed.length < MIN_REPLY_LENGTH) return params.reply

  let humanized: string
  try {
    const result = await executeAI({
      mode: 'complete',
      taskType: 'chat',
      businessId: params.businessId,
      assistantId: params.assistantId,
      requestType: params.requestType,
      system: HUMANIZER_SYSTEM,
      messages: [{ role: 'user', content: buildHumanizePrompt(trimmed, params.customerText) }],
      maxTokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    })
    humanized = result.content.trim()
  } catch (err) {
    console.warn(
      `[humanizer] reescritura fallida, se usa el borrador: ${err instanceof Error ? err.message : String(err)}`
    )
    return params.reply
  }

  if (!humanized) {
    console.warn('[humanizer] reescritura vacía, se usa el borrador original')
    return params.reply
  }

  const violations = findSafetyViolations(humanized)
  if (violations.length > 0) {
    console.warn(
      `[humanizer] la reescritura violó la seguridad (${violations.map((v) => v.id).join(', ')}), se usa el borrador original`
    )
    return params.reply
  }

  return humanized
}