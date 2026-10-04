/**
 * Correccion de los 4 learning_events criticos de la cosecha.
 *
 * Los 4 fueron aprobados en lote por un script que copio el texto generado
 * por el analisis de la cosecha sin revision humana. Este script corrige el
 * texto en el sitio donde quedo (ai_instructions / sales_rules) y registra el
 * cambio en knowledge_versions, que es la bitacora de cambios de conocimiento.
 *
 * No borra ni crea knowledge duplicado: edita las filas existentes y anade
 * solo la regla que faltaba (fuga de instruccion interna al cliente).
 *
 * Dry-run por defecto. Aplicar con --apply.
 */

import { config } from 'dotenv'
import { createAdminClient } from '../src/lib/supabase/admin'

config({ path: '.env.local' })

const BUSINESS_ID = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'
const CHANGE_SOURCE = 'correction' as const

type Change =
  | {
      kind: 'update_ai_instruction'
      id: string
      category: string
      from: string
      to: string
      why: string
    }
  | {
      kind: 'update_sales_rule'
      category: string
      fromNeedle: string
      to: string
      why: string
    }
  | {
      kind: 'insert_ai_instruction'
      category: string
      to: string
      why: string
    }
  | { kind: 'degrade_severity'; category: string; from: string; to: string; why: string }

const CHANGES: Change[] = [
  {
    kind: 'update_ai_instruction',
    id: '25175463-795b-43f6-8437-a7a157acf75b',
    category: 'no_fuga_instrucciones_internas',
    from: 'No mencionar la base de datos, las reglas del juego ni las limitaciones del asistente.',
    to:
      'No mencionar la base de datos ni las reglas internas del asistente. Si falta información, decirlo con naturalidad y ofrecer una alternativa concreta; nunca inventar una respuesta para tapar ese hueco.',
    why: 'La versión anterior se contradecía: prohibía mencionar las limitaciones del asistente y a la vez pedía decirlo con naturalidad, lo que choca con honestidad_antes_que_promesa y admitir_lo_que_no_sabes.',
  },
  {
    kind: 'insert_ai_instruction',
    category: 'no_fuga_instruccion_al_cliente',
    to:
      'Nunca muestres al cliente texto dirigido al asistente. Sin asteriscos, sin "DEBES" o "NO DEBES", sin notas internas y sin menús de opciones con instrucciones embebidas. Todo lo que ve el cliente es texto natural para esa persona.',
    why: 'Regla que faltaba: la evidencia del evento no_repetir_menu_respondido mostraba *DEBES ELEGIR UN NÚMERO* dentro del mensaje al cliente, una fuga de instrucción interna que ninguna instrucción cubría.',
  },
  {
    kind: 'degrade_severity',
    category: 'no_inventar_testimonios',
    from: 'critical',
    to: 'medium',
    why: 'La evidencia reporta 0 ocurrencias del error en 133 mensajes y el original_response es un mensaje correcto de la vendedora: es un patrón positivo, no una falla de MIA que justifique severidad crítica.',
  },
  {
    kind: 'update_sales_rule',
    category: 'un_precio_por_producto',
    fromNeedle: 'derivarse del catálogo',
    to:
      'Nunca escribas un monto a mano: derivarlo siempre del catálogo. Si el producto tiene varios tamaños, confirmar el precio del tamaño específico antes de cerrar la venta.',
    why: 'La versión anterior embebía precios fijos (499, 449, 399, 550) que quedarán viejos, y describía una limitación del modelo de datos como si fuera una instrucción. La variación por tamaño se resuelve en el catálogo (ADR-017), no en el prompt.',
  },
]

async function main(dry: boolean) {
  const admin = createAdminClient()
  const now = new Date().toISOString()

  for (const c of CHANGES) {
    if (c.kind === 'update_ai_instruction') {
      const { data: before, error: e0 } = await admin
        .from('ai_instructions')
        .select('instruction')
        .eq('id', c.id)
        .single()
      if (e0) throw new Error(`lectura ${c.id}: ${e0.message}`)

      console.log(`\n[${dry ? 'DRY' : 'APPLY'}] ai_instructions ${c.category} (${c.id})`)
      console.log(`  antes : ${String(before.instruction).slice(0, 150)}`)
      console.log(`  despues: ${c.to.slice(0, 150)}`)
      console.log(`  motivo: ${c.why}`)
      if (dry) continue

      const { error } = await admin.from('ai_instructions').update({ instruction: c.to }).eq('id', c.id)
      if (error) throw new Error(`update ${c.id}: ${error.message}`)

      const { error: audit } = await admin.from('knowledge_versions').insert({
        business_id: BUSINESS_ID,
        entity_type: 'ai_instruction',
        entity_id: c.id,
        previous_value: { instruction: before.instruction },
        new_value: { instruction: c.to },
        change_source: 'correction',
      })
      if (audit) throw new Error(`bitacora ${c.category}: ${audit.message}`)
      continue
    }

    if (c.kind === 'update_sales_rule') {
      const { data: rows, error: e1 } = await admin
        .from('sales_rules')
        .select('id,category,content')
        .eq('business_id', BUSINESS_ID)
        .ilike('content', `%${c.fromNeedle}%`)
      if (e1) throw new Error(`lectura sales_rules: ${e1.message}`)

      console.log(`\n[${dry ? 'DRY' : 'APPLY'}] sales_rules ${c.category} -> ${rows?.length ?? 0} filas`)
      for (const r of rows ?? []) {
        console.log(`  antes : ${String(r.content).slice(0, 150)}`)
        console.log(`  despues: ${c.to.slice(0, 150)}`)
      }
      console.log(`  motivo: ${c.why}`)
      if (dry || (rows?.length ?? 0) === 0) continue

      const row = rows![0]
      const { error } = await admin.from('sales_rules').update({ content: c.to }).eq('id', row.id)
      if (error) throw new Error(`update sales_rule: ${error.message}`)

      const { error: audit } = await admin.from('knowledge_versions').insert({
        business_id: BUSINESS_ID,
        entity_type: 'sales_rule',
        entity_id: row.id,
        previous_value: { content: row.content },
        new_value: { content: c.to },
        change_source: 'correction',
      })
      if (audit) throw new Error(`bitacora ${c.category}: ${audit.message}`)
      continue
    }

    if (c.kind === 'insert_ai_instruction') {
      const { data: dup, error: e2 } = await admin
        .from('ai_instructions')
        .select('id')
        .eq('business_id', BUSINESS_ID)
        .ilike('instruction', '%texto dirigido al asistente%')
      if (e2) throw new Error(`lectura duplicados: ${e2.message}`)

      console.log(`\n[${dry ? 'DRY' : 'APPLY'}] insertar ai_instruction ${c.category}`)
      console.log(`  ya existe: ${(dup?.length ?? 0) > 0 ? 'SI, se omite' : 'no'}`)
      console.log(`  texto: ${c.to.slice(0, 150)}`)
      console.log(`  motivo: ${c.why}`)
      if (dry || (dup?.length ?? 0) > 0) continue

      const { data: ins, error } = await admin
        .from('ai_instructions')
        .insert({ business_id: BUSINESS_ID, instruction: c.to, source: 'correction' })
        .select('id')
        .single()
      if (error) throw new Error(`insert: ${error.message}`)

      const { error: audit } = await admin.from('knowledge_versions').insert({
        business_id: BUSINESS_ID,
        entity_type: 'ai_instruction',
        entity_id: ins.id,
        new_value: { instruction: c.to },
        change_source: 'correction',
      })
      if (audit) throw new Error(`bitacora ${c.category}: ${audit.message}`)
      continue
    }

    const { data: evs, error: e3 } = await admin
      .from('learning_events')
      .select('id,severity,status')
      .eq('business_id', BUSINESS_ID)
      .eq('category', c.category)
    if (e3) throw new Error(`lectura eventos: ${e3.message}`)

    console.log(`\n[${dry ? 'DRY' : 'APPLY'}] severidad ${c.category} -> ${c.to}`)
    console.log(`  eventos encontrados: ${evs?.length ?? 0}`)
    console.log(`  motivo: ${c.why}`)
    if (dry) continue

    for (const ev of evs ?? []) {
      const { error } = await admin
        .from('learning_events')
        .update({ severity: c.to })
        .eq('id', ev.id)
      if (error) throw new Error(`update severity: ${error.message}`)
      // knowledge_versions.entity_type no admite 'learning_event'
      // (CHECK en 001_initial_schema.sql:233), asi que este cambio de
      // severidad no tiene donde registrarse en la bitacora de conocimiento.
      console.log(`  [${ev.id}] severity ${ev.severity} -> ${c.to} (sin entrada en knowledge_versions)`)
    }
  }

  console.log(`\n${dry ? 'DRY-RUN: nada escrito' : 'listo'}`)
}

main(true)
  .then(() => {
    if (process.argv.includes('--apply')) return main(false)
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })