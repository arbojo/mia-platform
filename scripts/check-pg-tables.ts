import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  // Query information_schema directly via raw fetch to SQL endpoint
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  // Try to check via the sql endpoint
  const res = await fetch(`${url}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key!,
      'Authorization': `Bearer ${key!}`,
      'Prefer': 'params=single-object'
    },
    body: JSON.stringify({})
  })
  console.log('RPC test:', res.status)

  // Try direct REST API to a known table to see columns
  const res2 = await fetch(`${url}/rest/v1/businesses?select=id,name&limit=1`, {
    headers: { 'apikey': key!, 'Authorization': `Bearer ${key!}` }
  })
  console.log('businesses:', res2.status, await res2.text())

  // Let's try calling the database through a proxy — query pg_catalog via Supabase
  // The only way to do this without a custom function is to use the REST API on a table
  // that has all columns we need. Let me check the migration files for business_memory
  
  // Try insert via the REST API directly
  const insRes = await fetch(`${url}/rest/v1/business_memory`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key!,
      'Authorization': `Bearer ${key!}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      business_id: 'a0000000-0000-0000-0000-000000000001',
      memory_type: 'pattern',
      category: 'test',
      content: 'test',
      confidence: 50
    })
  })
  console.log('POST business_memory:', insRes.status, await insRes.text())
}

main().catch(console.error)
