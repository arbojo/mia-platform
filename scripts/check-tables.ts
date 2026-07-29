import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  const tables = [
    'businesses','brand_identities','products','knowledge_items','sales_rules',
    'ai_instructions','assistants','customers','assistant_memories','conversations',
    'messages','learning_events','knowledge_versions','ai_usage','lab_sessions',
    'channel_connections','channel_messages','knowledge_analysis_reports',
    'knowledge_suggestions','learning_reports','readiness_snapshots',
    'business_memory','mia_skills','weekly_reports','learning_velocity_snapshots'
  ]
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('id', { count: 'exact', head: true }).limit(1)
    console.log(t.padEnd(30), !error ? 'OK' : 'MISSING', error?.message?.slice(0,80) ?? '')
  }
}

main().catch(console.error)
