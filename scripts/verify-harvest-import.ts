import { config } from 'dotenv'
import { previewConversations } from '../src/lib/import/conversations'
import { createAdminClient } from '../src/lib/supabase/admin'

config({ path: '.env.local' })

const BUSINESS_ID = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'
const CHANNEL = 'whatsapp'

async function main() {
  const admin = createAdminClient()

  const { count: total } = await admin
    .from('channel_messages')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', BUSINESS_ID)
    .eq('channel', CHANNEL)

  const { count: harvest } = await admin
    .from('channel_messages')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', BUSINESS_ID)
    .eq('channel', CHANNEL)
    .like('external_id', 'harvest:%')

  const { data: linked } = await admin
    .from('channel_messages')
    .select('id')
    .eq('business_id', BUSINESS_ID)
    .like('external_id', 'harvest:%')
    .not('customer_id', 'is', null)

  const { data: sample, error: sampleError } = await admin
    .from('channel_messages')
    .select('direction, content, metadata, customer_id, received_at, external_customer_id')
    .eq('business_id', BUSINESS_ID)
    .like('external_id', 'harvest:%')
    .limit(3)

  const { data: range } = await admin
    .from('channel_messages')
    .select('received_at')
    .eq('business_id', BUSINESS_ID)
    .like('external_id', 'harvest:%')
    .order('received_at', { ascending: true })
    .limit(1)

  const { data: lastRange } = await admin
    .from('channel_messages')
    .select('received_at')
    .eq('business_id', BUSINESS_ID)
    .like('external_id', 'harvest:%')
    .order('received_at', { ascending: false })
    .limit(1)

  console.log('total channel_messages del negocio :', total)
  console.log('filas importadas (harvest:%)        :', harvest)
  console.log('harvest con customer_id informado  :', linked?.length ?? 0)
  console.log('rango desde                         :', range?.[0]?.received_at)
  console.log('rango hasta                         :', lastRange?.[0]?.received_at)
  if (sampleError) console.log('error muestra:', sampleError.message)
  console.log()
  console.log('MUESTRA DESDE SUPABASE:')
  for (const row of sample ?? []) {
    console.log(`  ${row.received_at}  ${row.direction}  ${row.external_customer_id}`)
    console.log(`     customer_id=${row.customer_id}`)
    console.log(`     author_label=${(row.metadata as Record<string, unknown>)?.author_label}`)
    console.log(`     ${String(row.content).slice(0, 110).replace(/\n/g, ' / ')}`)
  }

  // Idempotencia: reencolar el mismo conjunto no debe insertar nada.
  const rerun = await previewConversations({
    messages: [{ externalId: 'harvest:inexistente' }],
    businessId: BUSINESS_ID,
    channel: CHANNEL,
    admin,
  })
  console.log()
  console.log('control idempotencia -> inserted en reencolado:', rerun.counts.inserted)
}

main().catch((error: unknown) => {
  console.error('ERROR:', error)
  process.exit(1)
})