import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  const toCheck = [
    'business_memory', 'readiness_snapshots', 'learning_reports',
    'weekly_reports', 'learning_velocity_snapshots', 'mia_skills',
    'knowledge_suggestions', 'knowledge_analysis_reports', 'channel_connections', 'channel_messages'
  ]
  
  for (const t of toCheck) {
    const { data, error } = await supabase.from(t).select('*').limit(1)
    // Also try head
    const { error: headErr } = await supabase.from(t).select('id', { head: true, count: 'exact' }).limit(1)
    console.log(t.padEnd(35), error ? 'GET-FAIL' : 'GET-OK', headErr ? 'HEAD-FAIL' : 'HEAD-OK', error?.message?.slice(0,60) ?? '')
    
    if (!error && data && data.length > 0) {
      console.log('  columns:', Object.keys(data[0]).join(', '))
    }
  }
}

main().catch(console.error)
