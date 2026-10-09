import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function main() {
  const c = createClient(url, key);
  const { data: userData } = await c.auth.getUser();
  console.log('USER:', userData.user?.id, userData.user?.email);
  
  const { data: biz } = await c.from('businesses').select('id,name,owner_id,onboarding_status,created_at').order('created_at', { ascending: false }).limit(10);
  console.log('BUSINESSES:', JSON.stringify(biz, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
