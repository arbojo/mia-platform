import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const env: Record<string, string> = {}
for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const bid = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'

async function main() {
  const { data: bus } = await c.from('businesses').select('id, name, owner_id, onboarding_status').eq('id', bid)
  console.log('BUSINESS:', JSON.stringify(bus))

  for (const t of ['products', 'sales_rules', 'knowledge_items', 'ai_instructions', 'brand_identities', 'assistants']) {
    const { data, error } = await c.from(t).select('*').eq('business_id', bid)
    console.log(
      t.toUpperCase(),
      '=>',
      error ? 'ERR ' + error.message : (data?.length ?? 0) + ' rows'
    )
  }

  const { data: ch, error: chErr } = await c
    .from('assistant_channels')
    .select('assistant_id, channel, is_active')
    .eq('assistant_id', '2f57cd29-fef3-4167-8745-4f02b57d4850')
  console.log('ASSISTANT_CHANNELS =>', chErr ? 'ERR ' + chErr.message : JSON.stringify(ch))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
