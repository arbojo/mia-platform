import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('=== Assistant & Business Check ===\n');

  // 1. Check assistant 2f57cd29 (from conversation 05ae2db6)
  console.log('--- Assistant 2f57cd29 ---');
  const { data: asst, error: asstErr } = await supabase
    .from('assistants')
    .select('id, business_id, name, is_active')
    .eq('id', '2f57cd29-fef3-4167-8745-4f02b57d4850')
    .single();
  if (asstErr) console.error('Error:', asstErr);
  else console.log(JSON.stringify(asst, null, 2));

  // 2. Check business for this assistant
  if (asst) {
    console.log(`\n--- Business for assistant: ${asst.business_id} ---`);
    const { data: biz, error: bizErr } = await supabase
      .from('businesses')
      .select('id, name, owner_id')
      .eq('id', asst.business_id)
      .single();
    if (bizErr) console.error('Error:', bizErr);
    else console.log(JSON.stringify(biz, null, 2));
  }

  // 3. Check E2E Test Business
  console.log('\n--- E2E Test Business (d839de7e) ---');
  const { data: e2eBiz, error: e2eErr } = await supabase
    .from('businesses')
    .select('id, name, owner_id')
    .eq('id', 'd839de7e-0c17-4d5f-9519-f55a50fa71ae')
    .single();
  if (e2eErr) console.error('Error:', e2eErr);
  else console.log(JSON.stringify(e2eBiz, null, 2));

  // 4. Check all products in E2E Test Business
  console.log('\n--- All products in E2E Test Business ---');
  const { data: e2eProds, error: epErr } = await supabase
    .from('products')
    .select('id, name, is_active')
    .eq('business_id', 'd839de7e-0c17-4d5f-9519-f55a50fa71ae');
  if (epErr) console.error('Error:', epErr);
  else console.log(JSON.stringify(e2eProds, null, 2));

  // 5. Check all knowledge_items in E2E Test Business
  console.log('\n--- All knowledge items in E2E Test Business ---');
  const { data: e2eKnow, error: ekErr } = await supabase
    .from('knowledge_items')
    .select('id, question, answer, category, trigger_condition')
    .eq('business_id', 'd839de7e-0c17-4d5f-9519-f55a50fa71ae');
  if (ekErr) console.error('Error:', ekErr);
  else console.log(JSON.stringify(e2eKnow, null, 2));

  // 6. Check if there are any cross-business references
  console.log('\n--- Vitanova business ID: 4fb7418d-6c98-4a09-9094-4e4e4b2006a6 ---');
  
  // 7. Check the most recent messages in conversation 05ae2db6
  console.log('\n--- Last 10 messages in conversation 05ae2db6 ---');
  const { data: lastMsgs, error: lmErr } = await supabase
    .from('messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', '05ae2db6-a88a-4dd8-b08f-77725bce0757')
    .order('created_at', { ascending: false })
    .limit(10);
  if (lmErr) console.error('Error:', lmErr);
  else console.log(JSON.stringify(lastMsgs, null, 2));

  // 8. Check business_sales_config for Vitanova
  console.log('\n--- Business sales config for Vitanova ---');
  const { data: config, error: cfgErr } = await supabase
    .from('business_sales_config')
    .select('*')
    .eq('business_id', '4fb7418d-6c98-4a09-9094-4e4e4b2006a6')
    .maybeSingle();
  if (cfgErr) console.error('Error:', cfgErr);
  else console.log(JSON.stringify(config, null, 2));
}

main().catch(console.error);
