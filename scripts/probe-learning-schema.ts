import { config } from 'dotenv'
import { createAdminClient } from '../src/lib/supabase/admin'

config({ path: '.env.local' })

const BUSINESS_ID = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'

async function main() {
  const admin = createAdminClient()

  const { data: assistants, error: aErr } = await admin
    .from('assistants')
    .select('*')
    .eq('business_id', BUSINESS_ID)
  if (aErr) throw aErr
  console.log('columnas de assistants:', (assistants ?? [])[0] ? Object.keys((assistants ?? [])[0]).join(', ') : '(sin filas)')
  console.log('assistants:')
  for (const a of assistants ?? []) {
    console.log(`   ${JSON.stringify(a).slice(0, 220)}`)
  }

  const { data: existing, error: lErr } = await admin
    .from('learning_events')
    .select('id, correction_type, severity, category, status, original_response')
    .eq('business_id', BUSINESS_ID)
    .order('created_at', { ascending: false })
    .limit(5)
  if (lErr) throw lErr
  console.log()
  console.log(`learning_events existentes para el negocio: ${(existing ?? []).length}`)
  for (const e of existing ?? []) {
    console.log(`   [${e.status}] ${e.correction_type}/${e.severity}/${e.category ?? '-'} :: ${e.original_response.slice(0, 90)}`)
  }
}

main().catch((e: unknown) => {
  console.error('ERROR:', e)
  process.exit(1)
})