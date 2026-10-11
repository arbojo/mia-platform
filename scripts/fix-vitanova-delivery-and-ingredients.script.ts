import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Corrección de datos de Vitanova detectada en el análisis de la conversación
 * de Lulu (venta perdida) y del histórico de WhatsApp de 10 días:
 *
 *  1. Aguascalientes no existía en `delivery_schedules` y la KB lo citaba con
 *     días equivocados ("martes y jueves"). El negocio confirmó "lunes y jueves".
 *  2. Diabetic Patch: la instrucción p=8 evitaba nombrar los ingredientes y
 *     Lulu lo leyó como evasión ("no contestas las preguntas"). El negocio
 *     autorizó nombrarlos.
 *
 * Idempotente: cada paso busca por contenido y solo aplica si el valor actual
 * difiere. Reejecutarlo no produce cambios.
 */

const VITANOVA_BUSINESS_ID = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'

const AGT_CITY = 'Aguascalientes'
const AGT_DAYS = [1, 4] // lunes, jueves

const OLD_KB_AGT = 'Aguascalientes: martes y jueves.'
const NEW_KB_AGT = 'Aguascalientes: lunes y jueves.'

const INGREDIENTS_QUESTION =
  'El Diabetic Patch, ¿de qué está hecho? ¿Qué contiene o qué hierbas trae?'
const INGREDIENTS_ANSWER =
  'El Diabetic Patch está hecho a base de ingredientes de origen vegetal, entre ellos: ' +
  'raíz de Coptis, canela, raíz de Astrágalo, ginseng y cúrcuma. ' +
  'Es un parche de uso diario (uno cada 24 horas, colocado en hombro, espalda o vientre bajo) ' +
  'pensado para acompañar la rutina de cuidado de la glucosa. No es un tratamiento médico.'

const OLD_TONE_BULLET =
  '- Tono: comercial, cercano y confiable. NO conviertas la conversación en una explicación técnica de los ingredientes. Si el cliente pregunta de qué está hecho, MIA responde que es una fórmula de ingredientes de origen vegetal y hierbas adaptógenas, sin presentarlos como tratamiento ni entrar en farmacología.'
const NEW_TONE_BULLET =
  '- Tono: comercial, cercano y confiable. Si el cliente pregunta de qué está hecho, MIA NOMBRA los ingredientes reales que están en la base de conocimiento (raíz de Coptis, canela, raíz de Astrágalo, ginseng y cúrcuma), como ingredientes de una fórmula de origen vegetal. Nombra lo que hay; NUNCA respondas que no tienes esa información. Sin presentarlos como tratamiento ni entrar en farmacología.'

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {}
  const text = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of text.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match) out[match[1]] = match[2].trim()
  }
  return out
}

async function main(): Promise<void> {
  const env = loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRole) {
    console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
    process.exit(1)
  }
  const supabase = createClient(url, serviceRole)
  const B = VITANOVA_BUSINESS_ID
  let changes = 0

  // ── 1. delivery_schedules: Aguascalientes (lunes y jueves) ──────────────────
  const { data: existingSchedule } = await supabase
    .from('delivery_schedules')
    .select('id, delivery_days')
    .eq('business_id', B)
    .eq('city', AGT_CITY)
    .maybeSingle()

  const sameDays =
    existingSchedule?.delivery_days?.length === AGT_DAYS.length &&
    [...AGT_DAYS].sort().every((d, i) => d === [...(existingSchedule?.delivery_days ?? [])].sort()[i])

  if (!existingSchedule) {
    const { error } = await supabase.from('delivery_schedules').insert({
      business_id: B,
      city: AGT_CITY,
      delivery_days: AGT_DAYS,
      delivery_window_start: '09:00:00',
      delivery_window_end: '19:00:00',
    })
    if (error) throw error
    console.log(`[schedule] + ${AGT_CITY} creado con días [${AGT_DAYS}]`)
    changes++
  } else if (!sameDays) {
    const { error } = await supabase
      .from('delivery_schedules')
      .update({ delivery_days: AGT_DAYS, updated_at: new Date().toISOString() })
      .eq('id', existingSchedule.id)
    if (error) throw error
    console.log(`[schedule] ~ ${AGT_CITY} actualizado a días [${AGT_DAYS}]`)
    changes++
  } else {
    console.log(`[schedule] = ${AGT_CITY} ya en [${AGT_DAYS}]`)
  }

  // ── 2. KB: días correctos de Aguascalientes ────────────────────────────────
  const { data: kbCities } = await supabase
    .from('knowledge_items')
    .select('id, answer')
    .eq('business_id', B)
    .ilike('answer', '%Aguascalientes:%')

  for (const row of kbCities ?? []) {
    if (row.answer.includes(OLD_KB_AGT)) {
      const { error } = await supabase
        .from('knowledge_items')
        .update({ answer: row.answer.replace(OLD_KB_AGT, NEW_KB_AGT), updated_at: new Date().toISOString() })
        .eq('id', row.id)
      if (error) throw error
      console.log(`[kb] ~ días de AGT corregidos en ${row.id}`)
      changes++
    } else if (row.answer.includes(NEW_KB_AGT)) {
      console.log(`[kb] = días de AGT ya correctos en ${row.id}`)
    }
  }

  // ── 3. KB: ingredientes del Diabetic Patch ─────────────────────────────────
  const { data: existingIngredients } = await supabase
    .from('knowledge_items')
    .select('id')
    .eq('business_id', B)
    .ilike('question', '%Diabetic Patch%')
    .ilike('question', '%hierbas%')

  if (!existingIngredients || existingIngredients.length === 0) {
    const { error } = await supabase.from('knowledge_items').insert({
      business_id: B,
      category: 'faq',
      question: INGREDIENTS_QUESTION,
      answer: INGREDIENTS_ANSWER,
      source: 'manual',
      confidence: 'high',
      is_active: true,
      media_type: 'image',
    })
    if (error) throw error
    console.log('[kb] + ingredientes del Diabetic Patch')
    changes++
  } else {
    console.log(`[kb] = ingredientes del Diabetic Patch ya presentes (${existingIngredients.length})`)
  }

  // ── 4. Instrucción p=8: permitir nombrar las hierbas ───────────────────────
  const { data: instructions } = await supabase
    .from('ai_instructions')
    .select('id, instruction')
    .eq('business_id', B)
    .eq('is_active', true)
    .ilike('instruction', '%Diabetic Patch (parche de uso diario)%')

  for (const row of instructions ?? []) {
    if (row.instruction.includes(OLD_TONE_BULLET)) {
      const { error } = await supabase
        .from('ai_instructions')
        .update({ instruction: row.instruction.replace(OLD_TONE_BULLET, NEW_TONE_BULLET) })
        .eq('id', row.id)
      if (error) throw error
      console.log(`[instruction] ~ p=8 relajado en ${row.id}`)
      changes++
    } else if (row.instruction.includes(NEW_TONE_BULLET)) {
      console.log(`[instruction] = p=8 ya relajado en ${row.id}`)
    } else {
      console.warn(`[instruction] ! no se encontró el bullet de Tono esperado en ${row.id}; se omite`)
    }
  }

  console.log(`\nListo. Cambios aplicados: ${changes}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
