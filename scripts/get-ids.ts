import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  const { data: biz } = await supabase.from('businesses').select('id, name')
  console.log('Businesses:', JSON.stringify(biz, null, 2))
  if (biz?.length) {
    const { data: asst } = await supabase.from('assistants').select('id, name').eq('business_id', biz[0].id).eq('is_active', true)
    console.log('Assistants:', JSON.stringify(asst, null, 2))
  }
}

main().catch(console.error)
