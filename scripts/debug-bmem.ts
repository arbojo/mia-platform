import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  let r = await s.from('business_memory').select('*', { count: 'exact', head: true }).limit(1)
  console.log('head true:', r.error?.message)

  r = await s.from('business_memory').select('id').limit(1)
  console.log('select id only:', r.error?.message, 'data:', JSON.stringify(r.data))

  r = await s.from('business_memory').select('*').limit(1)
  console.log('select *:', r.error?.message, 'data:', JSON.stringify(r.data))

  // Check learning_events schema
  const { data: le, error: leErr } = await s.from('learning_events').select('*').limit(1)
  console.log('learning_events columns:', le ? Object.keys(le[0] ?? {}) : 'no data', 'error:', leErr?.message)
}

main().catch(console.error)
