import { readFileSync } from 'node:fs'
import { config } from 'dotenv'
import {
  importConversations,
  previewConversations,
} from '../src/lib/import/conversations'
import { createAdminClient } from '../src/lib/supabase/admin'

config({ path: '.env.local' })

const BUSINESS_ID = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'
const CHANNEL = 'whatsapp'
const SOURCE =
  'C:\\Users\\david\\AppData\\Local\\Temp\\opencode\\wa\\out\\harvest_import_set.json'

const mode = process.argv[2] === 'import' ? 'import' : 'preview'

interface HarvestRow {
  business_id: string
  channel: string
  direction: 'incoming' | 'outgoing'
  content: string
  content_type: string
  external_id: string | null
  external_customer_id: string | null
  customer_id: null
  received_at: string
  sent_at: string | null
  status: string
  metadata: Record<string, unknown>
}

const raw = JSON.parse(readFileSync(SOURCE, 'utf8')) as HarvestRow[]

const messages = raw.map((row) => ({
  businessId: row.business_id,
  channel: row.channel,
  direction: row.direction,
  content: row.content,
  contentType: row.content_type,
  externalId: row.external_id,
  externalCustomerId: row.external_customer_id,
  customerId: null,
  receivedAt: row.received_at,
  sentAt: row.sent_at,
  status: row.status,
  authorLabel:
    typeof row.metadata?.author_label === 'string'
      ? (row.metadata.author_label as 'human' | 'customer' | 'bot' | 'bot_bug')
      : null,
  metadata: { source: row.metadata?.source, whatsapp_chat_jid: row.metadata?.whatsapp_chat_jid },
}))

const admin = createAdminClient()

async function main() {
  console.log(`modo: ${mode}`)
  console.log(`mensajes leidos: ${messages.length}`)
  console.log()

  if (mode === 'preview') {
    const result = await previewConversations({
      messages,
      businessId: BUSINESS_ID,
      channel: CHANNEL,
      admin,
      sampleSize: 3,
    })
    console.log(JSON.stringify({ ...result, sample: result.sample.length }, null, 2))
    console.log()
    console.log('MUESTRA:')
    for (const m of result.sample) {
      console.log(`  [${m.receivedAt}] ${m.direction} (${m.authorLabel})`)
      console.log(`     ${m.content.slice(0, 160).replace(/\n/g, ' / ')}`)
    }
    return
  }

  const result = await importConversations({
    messages,
    businessId: BUSINESS_ID,
    channel: CHANNEL,
    admin,
  })
  console.log(JSON.stringify(result, null, 2))
}

main().catch((error: unknown) => {
  console.error('ERROR:', error)
  process.exit(1)
})