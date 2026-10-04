import { config } from 'dotenv'
import { createAdminClient } from '../src/lib/supabase/admin'

config({ path: '.env.local' })

const BUSINESS_ID = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'

async function main() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('learning_events')
    .select('category, severity, correction_type, status, is_active, original_response, corrected_response, knowledge_change')
    .eq('business_id', BUSINESS_ID)
    .in('category', ['un_precio_por_producto', 'honestidad_antes_que_promesa'])
    .order('category')
  if (error) throw error

  for (const e of data ?? []) {
    const kc = e.knowledge_change as Record<string, unknown> | null
    const ev = kc?.evidence as { messages?: number; conversations?: number; quotes?: string[] } | undefined
    console.log('='.repeat(74))
    console.log(`${e.category}  [${e.severity}/${e.correction_type}]  status=${e.status}  is_active=${e.is_active}`)
    console.log('-'.repeat(74))
    console.log(`APRENDIZAJE: ${kc?.learning}`)
    console.log(`ORIGEN     : ${kc?.source} · approved=${kc?.approved}`)
    console.log(`EVIDENCIA  : ${ev?.messages} mensajes · ${ev?.conversations} conversaciones`)
    for (const q of ev?.quotes ?? []) console.log(`   - ${q}`)
    console.log(`ORIGINAL   : ${e.original_response.slice(0, 120)}`)
    console.log(`CORREGIDO  : ${e.corrected_response ? e.corrected_response.slice(0, 120) : '(prohibicion: sin equivalente humano)'}`)
  }
}

main().catch((e: unknown) => {
  console.error('ERROR:', e)
  process.exit(1)
})