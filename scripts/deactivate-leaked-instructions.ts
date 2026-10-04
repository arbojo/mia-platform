/**
 * Desactiva instrucciones que son transcripción de WhatsApp (F1).
 *
 * Nueve instrucciones permanentes resultaron ser fragmentos literales de
 * conversaciones: "le llegaria hoy a partir de las 2 pm", "no hay costo en el
 * envio", "una disculpa nuestro bot anda emocionado hoy". MIA las leía como
 * política en cada prompt.
 *
 * Desactivar, no borrar: los cinco lectores de `ai_instructions` filtran
 * `is_active = true`, así que la fila sale del prompt y queda disponible para
 * revertirla si el criterio fue demasiado agresivo.
 *
 * Cada desactivación escribe su fila en `knowledge_versions`, que es la bitácora
 * de cambios de conocimiento. Los errores se lanzan en vez de ignorarse: una
 * versión anterior de esta limpieza falló en silencio por tres CHECK violados y
 * dejó la base sin registro de lo que había cambiado.
 *
 * Idempotente: solo toca fugas que sigan activas, así que reejecutarlo no hace
 * nada.
 *
 * Dry-run por defecto. Aplicar con --apply.
 */

import { config } from 'dotenv'
import { createAdminClient } from '../src/lib/supabase/admin'
import { detectLeakage, fetchLeakInstructions, fetchLeakMessages } from '../src/lib/knowledge/leakage'

config({ path: '.env.local' })

const BUSINESS_ID = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'
const DRY_RUN = !process.argv.includes('--apply')
const REASON = 'texto literal de un mensaje de WhatsApp, no una instrucción'

async function main() {
  const admin = createAdminClient()
  const instructions = await fetchLeakInstructions(admin, BUSINESS_ID)
  const messages = await fetchLeakMessages(admin, BUSINESS_ID)
  const report = detectLeakage(instructions, messages)

  const targets = report.leaked.filter((f) => f.instruction.is_active)

  console.log('='.repeat(78))
  console.log(DRY_RUN ? 'DRY-RUN: desactivar fugas (no escribe nada)' : 'APLICANDO: desactivar fugas')
  console.log('='.repeat(78))
  console.log(`fugas detectadas: ${report.leaked.length}`)
  console.log(`a desactivar:     ${targets.length}`)
  console.log('')

  if (targets.length === 0) {
    console.log('nada que hacer: no hay fugas activas')
    return
  }

  for (const { instruction, sources } of targets) {
    const origin = sources[0]
    console.log(`${instruction.id}  ${JSON.stringify(instruction.instruction)}`)
    console.log(`  origen: ${origin?.external_id ?? 'local'} @${origin?.received_at.slice(0, 10) ?? '?'}`)

    if (DRY_RUN) continue

    const { error: updateError } = await admin
      .from('ai_instructions')
      .update({ is_active: false })
      .eq('id', instruction.id)
      .eq('is_active', true)

    if (updateError) throw new Error(`desactivar ${instruction.id}: ${updateError.message}`)

    const { error: auditError } = await admin.from('knowledge_versions').insert({
      business_id: BUSINESS_ID,
      entity_type: 'ai_instruction',
      entity_id: instruction.id,
      previous_value: { instruction: instruction.instruction, is_active: true },
      new_value: { instruction: instruction.instruction, is_active: false, deactivated_reason: REASON },
      change_source: 'correction',
    })

    if (auditError) throw new Error(`bitácora ${instruction.id}: ${auditError.message}`)
    console.log('  ok: desactivada + bitácora')
  }

  if (DRY_RUN) {
    console.log('')
    console.log('dry-run: nada escrito. Aplicar con --apply')
    return
  }

  const after = await fetchLeakInstructions(admin, BUSINESS_ID)
  const afterReport = detectLeakage(after, messages)
  const stillActive = afterReport.leaked.filter((f) => f.instruction.is_active)

  console.log('')
  console.log('='.repeat(78))
  console.log(`verificación: fugas activas restantes = ${stillActive.length}`)
  console.log(`instrucciones activas: ${after.filter((i) => i.is_active).length} de ${after.length}`)
  console.log('='.repeat(78))

  if (stillActive.length > 0) {
    throw new Error(`quedan ${stillActive.length} fugas activas`)
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})