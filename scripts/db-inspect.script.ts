import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const { data: businesses, error } = await admin
    .from('businesses')
    .select('id, name, owner_id, onboarding_status')

  if (error) {
    console.error('ERROR businesses:', error.message)
    return
  }
  console.log('=== BUSINESSES ===')
  for (const b of businesses) {
    console.log(`- ${b.name} | owner=${b.owner_id} | onboarding=${b.onboarding_status} | id=${b.id}`)
  }

  const { data: users, error: uErr } = await admin.auth.admin.listUsers({ perPage: 50 })
  if (uErr) {
    console.error('ERROR users:', uErr.message)
    return
  }
  console.log('=== AUTH USERS ===')
  for (const u of users.users) {
    const email = u.email ?? '(no email)'
    const provider = u.app_metadata?.provider ?? ''
    console.log(`- ${email} | provider=${provider} | id=${u.id} | created=${u.created_at}`)
  }
}

main()
