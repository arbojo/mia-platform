import { readFileSync } from 'node:fs'
import { config } from 'dotenv'
import { createAdminClient } from '../src/lib/supabase/admin'

config({ path: '.env.local' })

const BUSINESS_ID = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'
const PAYLOAD = 'C:\\Users\\david\\AppData\\Local\\Temp\\opencode\\wa\\out\\harvest_import_set.json'

type StyleLabel = 'customer' | 'human' | 'bot' | 'bot_bug'
type FinalLabel = StyleLabel | 'internal'

/**
 * Clasificador autoritativo del autor de cada mensaje de la cosecha.
 *
 * Reescribe las etiquetas de forma determinista y auditable, guardando las tres
 * señales: la etiqueta final, la del clasificador de estilo original, y el
 * motivo de la correccion (ADR-011: nada de heuristicas opacas en material
 * que acaba alimentando el entrenamiento).
 *
 * Ningun detector sirve solo:
 *  - el clasificador de estilo detecta bien las respuestas cortas de MIA
 *    ("¿Te gustaria saber el precio?") y los bucles de menu, pero confunde
 *    la salida de MIA sin emoji con mensajes de la vendedora;
 *  - las reglas deterministas detectan sin ambiguedad la salida de MIA con
 *    markdown, plantillas o testimonios inventados, pero son ciegas ante las
 *    respuestas cortas.
 *
 * Precedencia: entrante > interno > bug > senal determinista de MIA > estilo.
 */

/** Firmas verificadas manualmente (inicio del mensaje, sin depender del final). */
const MIA_SIGNATURES = [
  'No hay información específica para ofrecer',
  'Lo siento, pero no tengo información sobre Neurofeet en mi base de datos',
  'No puedo crear un mensaje a alguien por teléfono',
  '¡Hola! Con gusto te ayudo. El *Clean Nails*',
  '¡Qué bueno que te animes!',
  '¡Qué bueno que te decidiste!',
  '¡Qué bueno que le interese!',
  'Entiendo. Estaremos aquí para cuando gustes',
  '¡Claro que sí! Estaremos pendientes',
  '¡Excelente elección!',
  '¡Muchas gracias, Rosa María!',
  '¡Muchas gracias, Prisciliano!',
  'Es muy sencillo: solo debes *limar tu uña*',
  '¡Hola! Seguimos aquí por si todavía te interesa',
  '¡Hola! ¿Aún te gustaría recibir información',
  '¡Hola! Te escribo para saber si aún quieres conocer',
  '¡Hola! Te escribo para ver si aún te interesa conocer',
  '¡Hola! Solo quería saber si aún te interesa el dispositivo',
  '¡Hola! Solo quería saber si aún te interesa pedir',
  '¡Hola! Quería saber si aún te interesa adquirir',
  '¡Hola! Solo quería ver si aún te interesa el dispositivo',
  '¡Hola! Con gusto te ayudo. Nuestro dispositivo',
  '¡Hola! Con gusto te ayudo. ¿Qué te gustaría saber',
  'Lamentablemente, en estos momentos no puedo procesar',
  'Estoy para resolver sus dudas',
  'Si tienes alguna duda con respecto al funcionamiento y tiempo de resultados',
  'Hola, sigo aquí por si todavía te interesa adquirir',
  'Es un tratamiento cómodo facil de usar',
  'Cómo funciona? El aparato comienza a limpiar la uña desde la base',
  'Este cliente tiene un mes usándolo',
  'Este cliente lleva aproximadamente 1 mes y 2 semanas',
  'La base de la uña ya comenzo a crecer delgada',
  'La uña afectada ya no se recupera, tiene que pasar un ciclo',
  'No se preocupe, de hecho es una excelente opcion para las personas',
  'El envío no tiene costo y puedes pagar en efectivo con tarjeta o transferencia',
  'Tienes alguna duda del funcionamiento?',
  'Disculpe no estoy segura de haber entendido',
  'Con gusto le ayudo con cualquier duda que tenga',

  // Mensajes de menu y cierre indistinguibles entre MIA y la vendedora.
  // Revisados uno por uno el 2026-10-02 y etiquetados como bot por decision
  // explicita del usuario: se prefiere perder 3 cierres humanos antes que
  // dejar una sola salida de MIA dentro del set de entrenamiento humano.
  'Que precio tiene?',
  'Quieres saber cómo funciona o tienes alguna otra duda?',
  'le gustaria agendar su clean nails? le recordamos que el envio va por nuestra cuenta',
  'tiene alguna duda acerca del como funciona, como se usa, detalles de envio o pago?',
  'Claro!!! Esperamos su mensajito, quedamos a sus órdenes!!!',
  'Tienes dudas o deseas saber cómo funciona?',
  'Tu pedido ya está en ruta, si tienes alguna indicación extra',
]

/** Frases que solo produce el modelo, verificadas contra el corpus. */
const MIA_PHRASES =
  /mi base de datos|no puedo procesar tu solicitud|reglas del juego|no puedo crear un mensaje|permíteme transferirte|este cliente (lleva|tiene un mes)|su uña era tan gruesa|estaremos aquí para|estaremos pendientes para|para brindarle la información más útil|excelente elección|qué bueno que (te|le)|he recibido (tus|sus) datos|he conectado (tu|su) solicitud|con nuestro equipo para que agenden/i

/**
 * Excluido a proposito: "hola!!", "claro!!", "Hola buen dia!!!" que escribe la
 * vendedora con normalidad. Detectarlos por opening seria un falso positivo.
 *
 * Los JID internos son un numero personal del equipo: viven en el entorno, nunca
 * en el repositorio. Si faltan, el script falla en voz alta en vez de clasificar
 * de mas — taught-to-train sobre el chat del equipo es peor que no clasificar.
 */
const INTERNAL_JIDS = (process.env.HARVEST_INTERNAL_JIDS ?? '')
  .split(',')
  .map((jid) => jid.trim())
  .filter(Boolean)

if (INTERNAL_JIDS.length === 0) {
  throw new Error(
    'HARVEST_INTERNAL_JIDS no esta definido: lista separada por comas con los JID internos que nunca deben entrenarse.',
  )
}

const normalize = (t: string): string => t.replace(/\r\n?/g, '\n').replace(/\s+/g, ' ').trim()

export function deterministicMiaReason(content: string): string | null {
  const text = normalize(content)
  if (text.includes('*')) return 'markdown_bold'
  if (MIA_PHRASES.test(text)) return 'llm_template_phrase'
  for (const signature of MIA_SIGNATURES) {
    if (text.startsWith(signature)) return 'verified_mia_signature'
  }
  return null
}

export function classify(input: {
  direction: 'incoming' | 'outgoing'
  content: string
  externalCustomerId: string | null
  styleLabel: StyleLabel
}): { label: FinalLabel; style: StyleLabel; reason: string } {
  if (input.direction === 'incoming') {
    return { label: 'customer', style: input.styleLabel, reason: 'incoming_direction' }
  }
  if (INTERNAL_JIDS.includes(input.externalCustomerId ?? '')) {
    return { label: 'internal', style: input.styleLabel, reason: 'internal_team_jid' }
  }
  const text = normalize(input.content)
  if (text.toLowerCase() === 'true' || text.toLowerCase() === 'false') {
    return { label: 'bot_bug', style: input.styleLabel, reason: 'boolean_payload' }
  }
  const reason = deterministicMiaReason(input.content)
  if (reason) return { label: 'bot', style: input.styleLabel, reason }
  return { label: input.styleLabel, style: input.styleLabel, reason: 'style_classifier' }
}

async function main() {
  const admin = createAdminClient()

  const payload = JSON.parse(readFileSync(PAYLOAD, 'utf8')) as Array<{
    external_id: string
    direction: 'incoming' | 'outgoing'
    content: string
    external_customer_id: string | null
    author_label: StyleLabel
  }>

  const styleByExternalId = new Map(payload.map((m) => [m.external_id, m.author_label]))

  const { data, error } = await admin
    .from('channel_messages')
    .select('id, content, direction, external_id, metadata, external_customer_id')
    .eq('business_id', BUSINESS_ID)
    .like('external_id', 'harvest:%')

  if (error) throw error

  const rows = (data ?? []) as Array<{
    id: string
    content: string
    direction: 'incoming' | 'outgoing'
    external_id: string
    metadata: Record<string, unknown> | null
    external_customer_id: string | null
  }>

  const counts = new Map<string, number>()
  const reasons = new Map<string, number>()
  const corrections = new Map<string, number>()
  let updated = 0

  for (const row of rows) {
    const styleLabel = styleByExternalId.get(row.external_id) ?? 'human'
    const verdict = classify({
      direction: row.direction,
      content: String(row.content),
      externalCustomerId: row.external_customer_id,
      styleLabel,
    })

    counts.set(verdict.label, (counts.get(verdict.label) ?? 0) + 1)
    reasons.set(verdict.reason, (reasons.get(verdict.reason) ?? 0) + 1)
    if (verdict.label !== styleLabel) {
      corrections.set(`${styleLabel} -> ${verdict.label}`, (corrections.get(`${styleLabel} -> ${verdict.label}`) ?? 0) + 1)
    }

    const nextMetadata = {
      ...row.metadata,
      author_label: verdict.label,
      author_label_style: verdict.style,
      author_label_reason: verdict.reason,
    }
    if (row.metadata?.author_label === verdict.label && row.metadata?.author_label_reason === verdict.reason) continue

    await admin
      .from('channel_messages')
      .update({ metadata: nextMetadata })
      .eq('id', row.id)
    updated += 1
  }

  console.log('filas actualizadas:', updated)
  console.log()
  console.log('distribucion final:')
  for (const [k, v] of [...counts].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${k.padEnd(10)} ${v}`)
  }
  console.log(`   ${'TOTAL'.padEnd(10)} ${[...counts.values()].reduce((a, b) => a + b, 0)}`)
  console.log()
  console.log('motivo de la etiqueta:')
  for (const [k, v] of [...reasons].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${String(v).padStart(3)}x  ${k}`)
  }
  console.log()
  console.log('correcciones sobre el clasificador de estilo:')
  for (const [k, v] of [...corrections].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${String(v).padStart(3)}x  ${k}`)
  }
}

main().catch((e: unknown) => {
  console.error('ERROR:', e)
  process.exit(1)
})