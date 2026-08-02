import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

const TABLES = [
  'businesses', 'brand_identities', 'products', 'knowledge_items', 'sales_rules',
  'ai_instructions', 'assistants', 'assistant_channels', 'customers',
  'assistant_memories', 'conversations', 'messages', 'learning_events',
  'knowledge_versions', 'ai_usage', 'lab_sessions', 'knowledge_analysis_reports',
  'knowledge_suggestions', 'channel_connections', 'channel_messages',
  'readiness_snapshots', 'learning_reports', 'business_memory', 'mia_skills',
  'weekly_reports', 'learning_velocity_snapshots', 'mia_signals',
  'new_orders', 'orders', 'bot_logs', 'system_logs', 'whatsapp_leads',
  'sepomex', 'codigos_postales', 'channels', 'product_batches',
  'inventory_ledger', 'product_variants', 'product_prices', 'leads_marketing',
  'bot_state', 'broadcast_jobs', 'store_config', 'meta_ad_spend',
  'app_settings', 'agent_feedback', 'training_samples', 'learning_candidates',
]

async function main() {
  console.log('URL:', url)
  for (const t of TABLES) {
    const res = await fetch(`${url}/rest/v1/${t}?select=*&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (res.status === 200) {
      console.log(`${t.padEnd(32)} EXISTS (200)`)
    } else if (res.status === 404) {
      console.log(`${t.padEnd(32)} MISSING (404)`)
    } else {
      const body = (await res.text()).slice(0, 120)
      console.log(`${t.padEnd(32)} HTTP ${res.status} ${body}`)
    }
  }
}

main().catch((e) => {
  console.error('FATAL:', e.message)
  process.exit(1)
})
