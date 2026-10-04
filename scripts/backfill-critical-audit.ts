/**
 * Backfill de la bitacora para la correccion de los 4 learning_events criticos.
 *
 * El script fix-critical-learnings.ts aplico los cambios de texto pero sus
 * inserts en knowledge_versions fallaron en silencio por tres motivos:
 * change_source fuera del CHECK, columna old_value en vez de previous_value, y
 * entity_type 'learning_event' que el CHECK no admite. El texto de las filas ya
 * corregido es correcto; lo que falta es la auditoria.
 *
 * El "antes" se lee de learning_events.knowledge_change.learning, que nunca se
 * modifico y es la fuente original de lo que se escribio.
 *
 * Idempotente: si ya existe una version para la entidad con el mismo
 * new_value, no inserta otra.
 */

import { config } from 'dotenv'
import { createAdminClient } from '../src/lib/supabase/admin'

config({ path: '.env.local' })

const BUSINESS_ID = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'

type Backfill = {
  entity_type: 'ai_instruction' | 'sales_rule'
  entity_id: string
  category: string
  previous_value: Record<string, unknown> | null
  new_value: Record<string, unknown>
}

async function main() {
  const admin = createAdminClient()

  const { data: events, error } = await admin
    .from('learning_events')
    .select('category,knowledge_change')
    .eq('business_id', BUSINESS_ID)
    .in('category', ['no_fuga_instrucciones_internas', 'un_precio_por_producto'])
  if (error) throw error

  const originalLearning = new Map<string, string>()
  for (const ev of events ?? []) {
    const kc = (ev.knowledge_change ?? {}) as Record<string, unknown>
    originalLearning.set(ev.category, String(kc.learning ?? ''))
  }

  const { data: ai, error: e2 } = await admin
    .from('ai_instructions')
    .select('id,instruction')
    .eq('business_id', BUSINESS_ID)
    .in(
      'id',
      ['25175463-795b-43f6-8437-a7a157acf75b', '202b0154-2ffc-41c0-93bf-77f647774ea3'],
    )
  if (e2) throw e2

  const { data: sr, error: e3 } = await admin
    .from('sales_rules')
    .select('id,content')
    .eq('business_id', BUSINESS_ID)
    .ilike('content', '%derivarlo siempre del catálogo%')
  if (e3) throw e3

  const backfills: Backfill[] = []

  for (const row of ai ?? []) {
    const isNew = row.id === '202b0154-2ffc-41c0-93bf-77f647774ea3'
    backfills.push({
      entity_type: 'ai_instruction',
      entity_id: row.id,
      category: isNew ? 'no_fuga_instruccion_al_cliente (nueva)' : 'no_fuga_instrucciones_internas',
      previous_value: isNew
        ? null
        : { instruction: originalLearning.get('no_fuga_instrucciones_internas') },
      new_value: { instruction: row.instruction },
    })
  }

  for (const row of sr ?? []) {
    backfills.push({
      entity_type: 'sales_rule',
      entity_id: row.id,
      category: 'un_precio_por_producto',
      previous_value: { content: originalLearning.get('un_precio_por_producto') },
      new_value: { content: row.content },
    })
  }

  for (const b of backfills) {
    const { data: existing } = await admin
      .from('knowledge_versions')
      .select('id')
      .eq('entity_type', b.entity_type)
      .eq('entity_id', b.entity_id)
      .eq('new_value', b.new_value)
      .limit(1)

    if ((existing ?? []).length > 0) {
      console.log(`skip (ya registrado): ${b.category}`)
      continue
    }

    const { error: insErr } = await admin.from('knowledge_versions').insert({
      business_id: BUSINESS_ID,
      entity_type: b.entity_type,
      entity_id: b.entity_id,
      previous_value: b.previous_value,
      new_value: b.new_value,
      change_source: 'correction',
    })
    if (insErr) throw new Error(`${b.category}: ${insErr.message}`)
    console.log(`registrado: ${b.category} (${b.entity_type})`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})