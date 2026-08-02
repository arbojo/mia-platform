import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const MIA_TABLES = [
  'businesses',
  'brand_identities',
  'products',
  'knowledge_items',
  'sales_rules',
  'ai_instructions',
  'assistants',
  'assistant_channels',
  'customers',
  'assistant_memories',
  'conversations',
  'messages',
  'learning_events',
  'knowledge_versions',
  'ai_usage',
  'lab_sessions',
  'knowledge_analysis_reports',
  'knowledge_suggestions',
  'channel_connections',
  'channel_messages',
  'readiness_snapshots',
  'learning_reports',
  'business_memory',
  'mia_skills',
  'weekly_reports',
  'learning_velocity_snapshots',
  'mia_signals',
]

async function main() {
  console.log('URL:', url)
  console.log('=== MIA CORE TABLES ===')
  for (const t of MIA_TABLES) {
    const { count, error } = await supabase
      .from(t)
      .select('id', { count: 'exact', head: true })
    if (error) {
      console.log(`${t.padEnd(32)} MISSING (${error.code ?? 'err'}) ${error.message.slice(0, 60)}`)
    } else {
      console.log(`${t.padEnd(32)} OK rows=${count}`)
    }
  }

  console.log('\n=== KNOWN FOREIGN/STORE TABLES (should NOT be in MIA Lab) ===')
  const foreign = [
    'new_orders', 'orders', 'bot_logs', 'system_logs', 'whatsapp_leads',
    'sepomex', 'codigos_postales', 'channels', 'product_batches',
    'inventory_ledger', 'product_variants', 'product_prices', 'leads_marketing',
    'bot_state', 'broadcast_jobs', 'store_config', 'meta_ad_spend',
  ]
  for (const t of foreign) {
    const { count, error } = await supabase
      .from(t)
      .select('*', { count: 'exact', head: true })
    if (error) {
      console.log(`${t.padEnd(32)} NOT PRESENT`)
    } else {
      console.log(`${t.padEnd(32)} PRESENT rows=${count}`)
    }
  }
}

main().catch((e) => {
  console.error('FATAL:', e.message)
  process.exit(1)
})
