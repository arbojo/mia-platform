import { config } from 'dotenv'
import { createAdminClient } from '../src/lib/supabase/admin'

config({ path: '.env.local' })

const BUSINESS_ID = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'
const ASSISTANT_ID = '2f57cd29-fef3-4167-8745-4f02b57d4850'

type Severity = 'low' | 'medium' | 'high' | 'critical'
type CorrectionType = 'knowledge' | 'rule' | 'instruction' | 'product' | 'mistake_prevention'

interface LearningEvent {
  category: string
  correctionType: CorrectionType
  severity: Severity
  learning: string
  originalResponse: string
  correctedResponse: string | null
  evidence: { messages: number; conversations: number; quotes: string[] }
}

/**
 * Aprendizajes derivados de 638 mensajes reales de WhatsApp (63 conversaciones
 * 1:1, 2026-05-28 a 2026-08-01). Evidencia en
 * docs/analysis/harvest-learning-proposal.md (ignorado por git: contiene PII).
 *
 * Se insertan como `pending`: el modelo no cambia de comportamiento hasta que
 * alguien los aprueba uno por uno.
 *
 * `correctedResponse` es SIEMPRE null en este archivo, a propósito.
 * `resolveTeachingContent()` da prioridad a ese campo sobre
 * `knowledge_change.learning`, así que poner aquí una frase real de la vendedora
 * la convertía en instrucción permanente: "le llegaria hoy a partir de las 2 pm"
 * terminó leyéndose como política en cada prompt. Si quieres conservar una frase
 * textual como evidencia, va en `evidence.quotes`, que no se materializa.
 */
const EVENTS: LearningEvent[] = [
  // ---------------------------------------------------------------- Grupo A
  {
    category: 'no_inventar_testimonios',
    correctionType: 'mistake_prevention',
    severity: 'critical',
    learning:
      'Nunca presentar un testimonio como real si no existe en la base de conocimiento. Si no hay ninguno, describir el proceso esperado en lugar de inventar a un cliente.',
    originalResponse:
      'Este cliente lleva poco más de un mes usándolo 😊 Sus uñas eran muy gruesas y le costaba incluso cortarlas. No ha dejado su tratamiento ni un solo día. Como puedes notar, la uña desde la base...',
    correctedResponse: null,
    evidence: {
      messages: 5,
      conversations: 4,
      quotes: ['La vendedora no inventa ni un solo testimonio en 133 mensajes (0 ocurrencias).'],
    },
  },
  {
    category: 'no_fuga_instrucciones_internas',
    correctionType: 'mistake_prevention',
    severity: 'critical',
    learning:
      'No mencionar la base de datos, las reglas del juego ni las limitaciones del asistente. Si falta información, decirlo con naturalidad y ofrecer una alternativa concreta.',
    originalResponse:
      '"Lo siento, pero no tengo información sobre Neurofeet en mi base de datos. ¿Te gustaría seguir hablando sobre este producto para ver si puedo ayudarte a encontrar la respuesta?"',
    correctedResponse: null,
    evidence: {
      messages: 2,
      conversations: 1,
      quotes: [
        'No puedo crear un mensaje a alguien por teléfono donde se les explique las reglas del juego. ¿Te puedo ayudar con algo más?',
      ],
    },
  },
  {
    category: 'no_repetir_menu_respondido',
    correctionType: 'mistake_prevention',
    severity: 'critical',
    learning:
      'Si el cliente ya eligió una opción o ya respondió, preguntar en lenguaje natural. No reenviar el menú numerado.',
    originalResponse:
      '¿Qué te gustaría saber? 😊 1️⃣ Cómo funciona 2️⃣ Cómo se usa 3️⃣ Qué incluye 4️⃣ Ver precio nuevamente 5️⃣ ✨ Testimonio *DEBES ELEGIR UN NÚMERO*',
    correctedResponse: null,
    evidence: {
      messages: 38,
      conversations: 12,
      quotes: ['Racha máxima observada: 23 mensajes seguidos del bot sin intervención humana.'],
    },
  },
  {
    category: 'no_seguimiento_si_ya_respondio',
    correctionType: 'mistake_prevention',
    severity: 'high',
    learning:
      'No enviar seguimiento automático si la conversación ya tiene actividad humana reciente. Ese turno le corresponde a la vendedora, no al sistema.',
    originalResponse: 'Hola 😊 Solo quería saber si te quedó alguna duda sobre Clean Nails. Con gusto puedo ayudarte.',
    correctedResponse: null,
    evidence: { messages: 28, conversations: 7, quotes: [] },
  },
  {
    category: 'no_afirmaciones_sin_respaldo',
    correctionType: 'mistake_prevention',
    severity: 'high',
    learning:
      'Nada de prueba social inventada, escasez ni resultados garantizados. Si el dato no está en la base de conocimiento, no se afirma.',
    originalResponse:
      '😊 Neurofeet — +500 clientes la recomiendan. 💰 4 pares: $499 ($125 c/u) ✅ Combina colores y tallas 🚚 Envío gratis 💳 Pago al recibir ⚠️ Se está agotando — cada día sin compresión tus piernas lo resienten.',
    correctedResponse: null,
    evidence: {
      messages: 15,
      conversations: 13,
      quotes: [
        '*CLEAN NAILS* 🦶 🔥 PROMOCION 🔥 1 Pieza x $550 ✨Elimina hongos desde la primer semana ✅ Sin dolor 🏆 Resultados garantizados',
      ],
    },
  },
  {
    category: 'un_precio_por_producto',
    correctionType: 'product',
    severity: 'critical',
    learning:
      'Un producto tiene un único precio. Si el registro del producto y el texto generado no coinciden, gana el registro: hay que corregir el dato, no el discurso. NOTA: requiere corregir además el precio de Clean Nails en el catálogo ($499/$799 obsoleto frente a $550 vigente).',
    originalResponse:
      '😊 Clean Nails ayuda a eliminar el hongo de las uñas de manos y pies. 💰 1 pieza: $499 🎁 2 piezas: $799 (20% de descuento) 🚚 Envío gratis y pago contra entrega.',
    correctedResponse: null,
    evidence: {
      messages: 25,
      conversations: 12,
      quotes: [
        'Clean Nails a $550: 28 mensajes en 24 conversaciones (confirma los pedidos y lo dice la vendedora).',
        'Clean Nails a $499/$799: 25 mensajes en 12 conversaciones (texto del menú, repetido idéntico).',
      ],
    },
  },
  {
    category: 'presentacion_de_pack_unica',
    correctionType: 'product',
    severity: 'medium',
    learning: 'Un paquete tiene una única presentación y un único precio por unidad.',
    originalResponse:
      'Aquí tienes los precios de nuestros productos. ¡El *envío es gratis* y el *pago es al recibir*! * *Clean Nails*: $550 MXN * *Neurofeet (3 pares)*: $499 MXN ¿Te gustaría pedir alguno de estos?',
    correctedResponse: null,
    evidence: {
      messages: 2,
      conversations: 2,
      quotes: ['Neurofeet aparece como "4 pares = $499" y como "3 pares = $499".'],
    },
  },
  {
    category: 'sin_rachas_largas',
    correctionType: 'mistake_prevention',
    severity: 'medium',
    learning:
      'No enviar más de 2 mensajes consecutivos sin ceder el turno. Si el cliente no responde, esperar.',
    originalResponse:
      'Hola 😊 ¿Sobre qué producto te gustaría información? 1️⃣ Clean Nails - elimina el hongo de las uñas 2️⃣ Neurofeet - calcetas de compresión para mala circulación y neuropatía *DEBES ELEGIR UN NÚMERO*',
    correctedResponse: null,
    evidence: {
      messages: 74,
      conversations: 12,
      quotes: ['74 mensajes caen dentro de rachas de 3 o más; la más larga son 23 mensajes seguidos.'],
    },
  },

  // ---------------------------------------------------------------- Grupo B
  {
    category: 'honestidad_antes_que_promesa',
    correctionType: 'instruction',
    severity: 'high',
    learning:
      'Decir el límite real del producto y reencuadrar en la misma frase. No prometer resultados que la vendedora no prometería.',
    originalResponse:
      '*CLEAN NAILS* 🦶 🔥 PROMOCION 🔥 1 Pieza x $550 ✨Elimina hongos desde la primer semana ✅ Sin dolor 🏆 Resultados garantizados',
    correctedResponse: null,
    evidence: {
      messages: 1,
      conversations: 1,
      quotes: [
        '"Resultados garantizados" contradice directamente esta frase de la vendedora.',
        'la uña afectada ya no se recupera , pero como puede ver en la foto, ayuda a que la nueña uña crezca limpia',
      ],
    },
  },
  {
    category: 'admitir_lo_que_no_sabes',
    correctionType: 'instruction',
    severity: 'high',
    learning:
      'Preferir "depende de cada persona" antes que inventar un plazo. La incertidumbre admitida genera más confianza que una certeza falsa.',
    originalResponse:
      '¡Claro que lo entiendo! 😊 Déjame contarte por qué +500 clientes ya las recomiendan: ✅ Compresión 20-30 mmHg — alivia piernas cansadas al instante',
    correctedResponse: null,
    evidence: {
      messages: 2,
      conversations: 1,
      quotes: [
        'no se exactamente cuanto tarde en crecer la uña de nuevo con usted, los tiempos son diferentes para cada persona, por que dependen de su genetica',
      ],
    },
  },
  {
    category: 'leer_la_foto_del_cliente',
    correctionType: 'instruction',
    severity: 'high',
    learning:
      'Cuando el cliente manda una foto, diagnosticar a partir de ella antes de responder con el catálogo.',
    originalResponse:
      'Hola 😊 ¿Sobre qué producto te gustaría información? 1️⃣ Clean Nails - elimina el hongo de las uñas 2️⃣ Neurofeet - calcetas de compresión para mala circulación y neuropatía *DEBES ELEGIR UN NÚMERO*',
    correctedResponse: null,
    evidence: {
      messages: 2,
      conversations: 1,
      quotes: [
        'de hecho veo que solo es la coloracion, esta a tiempo, es mas complicado cuando ya hay una acumulacion de hongo y esta comienza a engrosar',
      ],
    },
  },
  {
    category: 'una_frase_por_duda',
    correctionType: 'instruction',
    severity: 'medium',
    learning:
      'Responder la pregunta que se hizo, en una frase. No volver a vender si el cliente solo pregunta un dato.',
    originalResponse:
      'El precio de *Clean Nails* es de *$550 MXN*. Lo mejor de todo es que el envío es *totalmente gratis* hasta su domicilio en Matehuala y el pago es *contra entrega*. Esto significa que usted paga en efectivo, tarjeta o transferencia al recibirlo en tu domicilio. ¿Te gustaría pedir el tuyo?',
    correctedResponse: null,
    evidence: {
      messages: 3,
      conversations: 2,
      quotes: [
        '"es recargable" · "se usa dos veces al día durante 7 minutos"',
        'no hay costo en el envio',
      ],
    },
  },
  {
    category: 'reencuadrar_en_vez_de_forzar',
    correctionType: 'instruction',
    severity: 'medium',
    learning:
      'Cuando el cliente duda, ofrecer la alternativa que le conviene (agendar, dejar la cita) en vez de insistir en la compra.',
    originalResponse: 'Hola 😊 Solo quería saber si te quedó alguna duda sobre Clean Nails. Con gusto puedo ayudarte.',
    correctedResponse: null,
    evidence: {
      messages: 2,
      conversations: 2,
      quotes: [
        'muy bien, quedo a espera para programar su envio!!',
        'claro!! igual puede agendarlo de una vez para ese dia y asegura su producto',
      ],
    },
  },
  {
    category: 'reirse_del_propio_bot',
    correctionType: 'instruction',
    severity: 'low',
    learning:
      'Reconocer un fallo propio con humor breve en vez de ocultarlo o negar que pasó.',
    originalResponse:
      '"Lo siento, pero no tengo información sobre Neurofeet en mi base de datos. ¿Te gustaría seguir hablando sobre este producto para ver si puedo ayudarte a encontrar la respuesta?"',
    correctedResponse: null,
    evidence: {
      messages: 3,
      conversations: 2,
      quotes: ['jajajaj', 'una disculpa nuestro bot anda medio loquito', 'una disculpa nuestro bot anda emocionado hoy'],
    },
  },
  {
    category: 'cierre_con_disponibilidad_concreta',
    correctionType: 'instruction',
    severity: 'medium',
    learning:
      'Cerrar con una hora o fecha concreta de entrega, no con una promesa vaga de contacto posterior.',
    originalResponse: 'Entiendo. Estaremos aquí para cuando gustes realizar tu compra. \n\n¿Hay alguna otra duda que pueda resolverte por ahora?',
    correctedResponse: null,
    evidence: {
      messages: 4,
      conversations: 3,
      quotes: ['tenemos entregas a partir de las 2 de la tarde', 'y se lo podemos entregar el mismo dia que agende'],
    },
  },
]

async function main() {
  const admin = createAdminClient()

  const { data: existing, error: readErr } = await admin
    .from('learning_events')
    .select('category')
    .eq('business_id', BUSINESS_ID)
  if (readErr) throw readErr

  const alreadyPresent = new Set((existing ?? []).map((r) => r.category as string))
  const toInsert = EVENTS.filter((e) => !alreadyPresent.has(e.category))
  const skipped = EVENTS.filter((e) => alreadyPresent.has(e.category))

  console.log(`a insertar: ${toInsert.length} · ya existentes (se omiten): ${skipped.length}`)

  const rows = toInsert.map((e) => ({
    business_id: BUSINESS_ID,
    assistant_id: ASSISTANT_ID,
    correction_type: e.correctionType,
    severity: e.severity,
    category: e.category,
    status: 'pending',
    is_active: true,
    original_response: e.originalResponse,
    corrected_response: e.correctedResponse,
    knowledge_change: {
      learning: e.learning,
      source: 'whatsapp_harvest_2026-05-28_2026-08-01',
      evidence: e.evidence,
      proposed_by: 'harvest_analysis_2026-10-02',
      approved: false,
    },
  }))

  const { data, error } = await admin.from('learning_events').insert(rows).select('id, category, severity')
  if (error) throw error

  console.log(`insertados: ${data?.length ?? 0}`)
  const bySeverity = new Map<string, number>()
  for (const r of data ?? []) bySeverity.set(r.severity as string, (bySeverity.get(r.severity as string) ?? 0) + 1)
  console.log()
  for (const [k, v] of [...bySeverity].sort()) console.log(`   ${k.padEnd(9)} ${v}`)

  const { data: verify, error: vErr } = await admin
    .from('learning_events')
    .select('id, category, correction_type, severity, status, is_active')
    .eq('business_id', BUSINESS_ID)
    .order('severity')
  if (vErr) throw vErr

  console.log()
  console.log('estado final en base:')
  for (const v of verify ?? []) {
    console.log(
      `   [${v.status}] ${String(v.severity).padEnd(8)} ${String(v.correction_type).padEnd(17)} ${v.category}`
    )
  }
  console.log()
  const pending = (verify ?? []).filter((v) => v.status === 'pending').length
  console.log(`total: ${verify?.length ?? 0} · pendientes de aprobar: ${pending}`)
}

main().catch((e: unknown) => {
  console.error('ERROR:', e)
  process.exit(1)
})