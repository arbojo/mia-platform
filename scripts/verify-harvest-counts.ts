import { config } from 'dotenv'
import { createAdminClient } from '../src/lib/supabase/admin'

config({ path: '.env.local' })

const B = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'

async function main() {
  const admin = createAdminClient()

  const { count: prev } = await admin
    .from('channel_messages')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', B)
    .not('external_id', 'like', 'harvest:%')

  const { count: harvest } = await admin
    .from('channel_messages')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', B)
    .like('external_id', 'harvest:%')

  const { count: beforeAug } = await admin
    .from('channel_messages')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', B)
    .like('external_id', 'harvest:%')
    .lt('received_at', '2026-08-04T00:00:00Z')

  const { count: groups } = await admin
    .from('channel_messages')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', B)
    .like('external_customer_id', '%@g.us')

  console.log('preexistentes (no harvest)      :', prev)
  console.log('importadas (harvest)             :', harvest)
  console.log('harvest anteriores a 2026-08-04  :', beforeAug)
  console.log('mensajes de grupo en toda la tabla:', groups)
}

main().catch((error: unknown) => {
  console.error('ERROR:', error)
  process.exit(1)
})