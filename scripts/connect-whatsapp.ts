import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const BIZ_ID = '0d40a769-7a21-4cb3-9472-bdc9638675d6'
const ASST_ID = '132732af-030c-4d82-9e1d-5f0ae214ac38'

async function main() {
  const credentials: Record<string, string> = {
    phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID || '123456789',
  }
  if (process.env.WHATSAPP_ACCESS_TOKEN) credentials.access_token = process.env.WHATSAPP_ACCESS_TOKEN
  if (process.env.WHATSAPP_APP_SECRET) credentials.app_secret = process.env.WHATSAPP_APP_SECRET
  if (process.env.WHATSAPP_VERIFY_TOKEN) credentials.verify_token = process.env.WHATSAPP_VERIFY_TOKEN

  const { data: existing } = await supabase
    .from('channel_connections')
    .select('id')
    .eq('business_id', BIZ_ID)
    .eq('assistant_id', ASST_ID)
    .eq('channel', 'whatsapp')
    .limit(1)
    .single()

  const mock = !process.env.WHATSAPP_ACCESS_TOKEN ? ' (mock)' : ''

  if (existing) {
    const { data, error } = await supabase
      .from('channel_connections')
      .update({ credentials, status: 'connected', updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) { console.error('Update error:', error); process.exit(1) }
    console.log(`WhatsApp connection updated: ${data.id}${mock}`)
  } else {
    const { data, error } = await supabase
      .from('channel_connections')
      .insert({
        business_id: BIZ_ID,
        assistant_id: ASST_ID,
        channel: 'whatsapp',
        credentials,
        status: 'connected',
      })
      .select()
      .single()

    if (error) { console.error('Insert error:', error); process.exit(1) }
    console.log(`WhatsApp connection created: ${data.id}${mock}`)
  }

  if (mock) {
    console.log('Provider: meta-cloud en MODO MOCK (define WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID para modo real).')
  } else {
    console.log('Provider: meta-cloud en MODO REAL.')
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
