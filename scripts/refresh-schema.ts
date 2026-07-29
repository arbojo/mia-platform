import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  // Try refreshing PostgREST schema cache
  const { data, error } = await supabase.rpc('exec_sql', { sql: 'NOTIFY pgrst, \'reload schema\';' }).select().single()
  if (error) {
    console.log('RPC failed (expected, no exec_sql function):', error.message)
  } else {
    console.log('Schema refresh sent via RPC')
  }

  // Try via raw SQL query on rest endpoint
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const res = await fetch(`${url}/rest/v1/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key!,
      'Authorization': `Bearer ${key!}`,
      'Accept': 'application/json'
    },
    body: JSON.stringify({ query: 'NOTIFY pgrst, \'reload schema\'' })
  })
  console.log('POST /rest/v1/ status:', res.status)

  // Try the management API
  const projectRef = url.replace('https://', '').split('.')[0]
  console.log('Project ref:', projectRef)

  // Check if we can access the table via the rest API raw
  const res2 = await fetch(`${url}/rest/v1/business_memory?select=id&limit=1`, {
    headers: {
      'apikey': key!,
      'Authorization': `Bearer ${key!}`
    }
  })
  console.log('GET business_memory status:', res2.status, await res2.text())
}

main().catch(console.error)
