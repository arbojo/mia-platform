import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  const { data: tables, error } = await supabase.rpc('exec_sql' as any, {
    sql: `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  })
  if (error) {
    // Try direct query
    const { data, error: e2 } = await supabase.from('_dummy').select('*').limit(0).maybeSingle() as any
    console.log('Direct query failed too:', e2?.message)
    // Try the SQL endpoint
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/get_tables`, {
      headers: { 'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}` }
    })
    console.log('Status:', res.status)
    const text = await res.text()
    console.log('Response:', text.slice(0, 200))
    return
  }
  console.log('Tables:', tables)
}

main().catch(console.error)
