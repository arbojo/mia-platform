import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  const BID = 'a0000000-0000-0000-0000-000000000001'

  // Check what columns exist on business_memory
  const { data: colData, error: colErr } = await supabase
    .from('business_memory')
    .select('*')
    .eq('business_id', BID)
    .limit(1) as any
  console.log('Columns from select:', colData ? Object.keys(colData[0] ?? {}) : 'no data')
  console.log('Select error:', colErr?.message)

  // Check RLS
  const { data: insData, error: insErr } = await supabase
    .from('business_memory')
    .insert({ business_id: BID, memory_type: 'pattern', category: 'customer_behavior', content: 'test', confidence: 50 })
    .select() as any
  console.log('Insert result:', insData)
  console.log('Insert error:', insErr)
}

main().catch(console.error)
