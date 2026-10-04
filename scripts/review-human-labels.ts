import { config } from 'dotenv'
import { createAdminClient } from '../src/lib/supabase/admin'

config({ path: '.env.local' })

const BUSINESS_ID = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'

/**
 * Vuelca los mensajes etiquetados como `human` para revision manual y marca los
 * que aun huelen a MIA ( senales que ninguna regla determinista cubre).
 */
const SUSPECT =
  /como puedo ayudar|cómo puedo ayudar|soy un asistente|por mi sistema|no tengo informaci|con gusto te|gestionar|cotizar|proveedor|supplier|¿te gustaría|te gustaría saber|encantad|disculpe las moleculares|menu|opción \d/i

async function main() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('channel_messages')
    .select('content, sent_at, external_customer_id, metadata')
    .eq('business_id', BUSINESS_ID)
    .like('external_id', 'harvest:%')
    .eq('direction', 'outgoing')
    .order('sent_at', { ascending: true })

  if (error) throw error

  const rows = (data ?? []) as Array<{
    content: string
    sent_at: string | null
    external_customer_id: string | null
    metadata: Record<string, unknown> | null
  }>

  const human = rows.filter((r) => r.metadata?.author_label === 'human')
  let suspectCount = 0

  for (const r of human) {
    const text = String(r.content).replace(/\s+/g, ' ').trim()
    const suspect = SUSPECT.test(text)
    if (suspect) suspectCount += 1
    const flag = suspect ? '  <-- REVISAR' : ''
    console.log(`[${(r.sent_at ?? '').slice(0, 16)}] ${(r.external_customer_id ?? '').slice(-4)} ${text.slice(0, 150)}${flag}`)
  }

  console.log()
  console.log(`human: ${human.length}  sospechosos: ${suspectCount}`)
}

main().catch((e: unknown) => {
  console.error('ERROR:', e)
  process.exit(1)
})