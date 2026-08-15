import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const VITANOVA_OWNER_EMAIL = 'arbojo@gmail.com'
const OLD_CONTENT =
  'Para generar el pedido se requiere confirmación explícita del cliente y su ciudad (para la fecha de entrega). El "me interesa" no es una compra.'
const NEW_CONTENT =
  'Para generar el pedido se requiere confirmación explícita del cliente y su ciudad (para la fecha de entrega). El "me interesa" no es una compra. Si el cliente se niega o desvía la conversación, NO insistas ni repitas la pregunta de confirmación: acéptalo con naturalidad y quédate disponible.'

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {}
  const text = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of text.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match) out[match[1]] = match[2].trim()
  }
  return out
}

async function main() {
  const env = loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRole) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  const supabase = createClient(url, serviceRole)

  const { data: users } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const owner = users.users.find((u) => u.email?.toLowerCase() === VITANOVA_OWNER_EMAIL)
  if (!owner) {
    console.error(`Owner ${VITANOVA_OWNER_EMAIL} not found.`)
    process.exit(1)
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', owner.id)
    .eq('name', 'Vitanova')
    .maybeSingle()
  if (!business) {
    console.error('Vitanova business not found.')
    process.exit(1)
  }

  const { data: rule } = await supabase
    .from('sales_rules')
    .select('id, content')
    .eq('business_id', business.id)
    .eq('content', OLD_CONTENT)
    .maybeSingle()

  if (!rule) {
    const { data: candidates } = await supabase
      .from('sales_rules')
      .select('id, content')
      .eq('business_id', business.id)
      .like('content', '%confirmación explícita%')
    if (candidates && candidates.length > 0) {
      console.log('Existing rule not exact match, but candidates found:')
      for (const c of candidates) console.log(`  ${c.id}: ${c.content}`)
    } else {
      console.log('No rule found with confirmation-explicita content.')
    }
    process.exit(1)
  }

  const { error } = await supabase
    .from('sales_rules')
    .update({ content: NEW_CONTENT })
    .eq('id', rule.id)

  if (error) {
    console.error(`Update failed: ${error.message}`)
    process.exit(1)
  }

  console.log(`✓ sales_rule ${rule.id} updated (business=${business.id})`)
  console.log(`  content: ${NEW_CONTENT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
