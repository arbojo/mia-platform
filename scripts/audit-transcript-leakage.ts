/**
 * Auditoría de fuga de transcripción a instrucciones (F0).
 *
 * Lista las instrucciones cuyo texto aparece literal dentro de un mensaje de
 * WhatsApp, con la evidencia del mensaje de origen. No decide: informa.
 *
 * Detecta con el mismo módulo que usa la limpieza (`@/lib/knowledge/leakage`),
 * para que ambas vistas no puedan divergir.
 *
 * Solo lectura. No escribe nada.
 */

import { config } from 'dotenv'
import { createAdminClient } from '../src/lib/supabase/admin'
import { detectLeakage, fetchLeakInstructions, fetchLeakMessages } from '../src/lib/knowledge/leakage'

config({ path: '.env.local' })

const BUSINESS_ID = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'

async function main() {
  const admin = createAdminClient()
  const instructions = await fetchLeakInstructions(admin, BUSINESS_ID)
  const messages = await fetchLeakMessages(admin, BUSINESS_ID)
  const report = detectLeakage(instructions, messages)

  console.log('='.repeat(78))
  console.log('FUGA DE TRANSCRIPCIÓN A INSTRUCCIONES')
  console.log('='.repeat(78))
  console.log(`instrucciones totales: ${instructions.length}`)
  console.log(`  activas:             ${instructions.filter((i) => i.is_active).length}`)
  console.log(`mensajes analizados:  ${messages.length}`)
  console.log('')

  for (const [text, group] of report.duplicates) {
    console.log(`duplicado x${group.length}: "${text.slice(0, 60)}"`)
    for (const row of group) console.log(`  ${row.id}`)
  }
  console.log('')

  console.log('-'.repeat(78))
  console.log(`FUGAS (texto literal de un mensaje): ${report.leaked.length}`)
  console.log(`  de ellas activas:                   ${report.leakedActiveIds.length}`)
  console.log(`GRUPOS DUPLICADOS:                   ${report.duplicates.size}`)
  console.log('-'.repeat(78))

  for (const { instruction, sources } of report.leaked) {
    console.log('')
    console.log(`[FUGA] ${instruction.id}`)
    console.log(`  source=${instruction.source} is_active=${instruction.is_active}`)
    console.log(`  created=${instruction.created_at.slice(0, 16)}`)
    console.log(`  texto: ${JSON.stringify(instruction.instruction)}`)
    for (const source of sources.slice(0, 2)) {
      console.log(
        `  - ${source.external_id ?? 'local'} @${source.received_at.slice(0, 10)}: ...${source.excerpt}...`,
      )
    }
  }

  console.log('')
  console.log('='.repeat(78))
  console.log(`A DESACTIVAR: ${report.leakedActiveIds.length}`)
  console.log('='.repeat(78))
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})