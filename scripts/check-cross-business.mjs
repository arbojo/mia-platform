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
  console.log('=== Cross-Business Data Check ===\n');

  // 1. Check business_memory for Vitanova
  console.log('--- business_memory for Vitanova (4fb7418d) ---');
  const { data: bizMem, error: bmErr } = await supabase
    .from('business_memory')
    .select('*')
    .eq('business_id', '4fb7418d-6c98-4a09-9094-4e4e4b2006a6');
  if (bmErr) console.error('Error:', bmErr);
  else {
    console.log(`Count: ${bizMem?.length ?? 0}`);
    // Search for E2E or Neurofeet in memory
    const e2eMem = (bizMem ?? []).filter(m =>
      JSON.stringify(m).toLowerCase().includes('e2e') ||
      JSON.stringify(m).toLowerCase().includes('neurofeet')
    );
    if (e2eMem.length > 0) {
      console.log('E2E/Neurofeet found in business_memory:', JSON.stringify(e2eMem, null, 2));
    } else {
      console.log('No E2E/Neurofeet in business_memory');
    }
    // Show all memory items
    for (const m of bizMem ?? []) {
      console.log(`\n  [${m.memory_type}] ${m.content?.substring(0, 200)}`);
    }
  }

  // 2. Check business_memory for E2E Test Business
  console.log('\n--- business_memory for E2E Test Business (d839de7e) ---');
  const { data: e2eMem, error: e2eErr } = await supabase
    .from('business_memory')
    .select('*')
    .eq('business_id', 'd839de7e-0c17-4d5f-9519-f55a50fa71ae');
  if (e2eErr) console.error('Error:', e2eErr);
  else {
    console.log(`Count: ${e2eMem?.length ?? 0}`);
    for (const m of e2eMem ?? []) {
      console.log(`  [${m.memory_type}] ${m.content?.substring(0, 200)}`);
    }
  }

  // 3. Check ALL business_memory for E2E or Neurofeet
  console.log('\n--- ALL business_memory containing "E2E" or "Neurofeet" ---');
  const { data: allMem, error: amErr } = await supabase
    .from('business_memory')
    .select('id, business_id, memory_type, content')
    .or('content.ilike.%E2E%,content.ilike.%Neurofeet%');
  if (amErr) console.error('Error:', amErr);
  else console.log(JSON.stringify(allMem, null, 2));

  // 4. Check ALL ai_instructions for E2E
  console.log('\n--- ALL ai_instructions containing "E2E" ---');
  const { data: allInstr, error: aiErr } = await supabase
    .from('ai_instructions')
    .select('id, business_id, instruction')
    .or('instruction.ilike.%E2E%');
  if (aiErr) console.error('Error:', aiErr);
  else console.log(JSON.stringify(allInstr, null, 2));

  // 5. Check ALL sales_rules for E2E
  console.log('\n--- ALL sales_rules containing "E2E" ---');
  const { data: allRules, error: arErr } = await supabase
    .from('sales_rules')
    .select('id, business_id, content')
    .or('content.ilike.%E2E%');
  if (arErr) console.error('Error:', arErr);
  else console.log(JSON.stringify(allRules, null, 2));

  // 6. Check ALL brand_identities for E2E
  console.log('\n--- ALL brand_identities containing "E2E" ---');
  const { data: allBrands, error: abErr } = await supabase
    .from('brand_identities')
    .select('id, business_id, business_name, tagline')
    .or('business_name.ilike.%E2E%,tagline.ilike.%E2E%');
  if (abErr) console.error('Error:', abErr);
  else console.log(JSON.stringify(allBrands, null, 2));

  // 7. Check ALL knowledge_items globally (full dump)
  console.log('\n--- ALL knowledge_items count by business ---');
  const { data: allKI, error: kiErr } = await supabase
    .from('knowledge_items')
    .select('business_id')
    .eq('is_active', true);
  if (kiErr) console.error('Error:', kiErr);
  else {
    const counts = {};
    for (const ki of allKI ?? []) {
      counts[ki.business_id] = (counts[ki.business_id] || 0) + 1;
    }
    console.log(JSON.stringify(counts, null, 2));
  }

  // 8. Check ALL products globally (full dump)
  console.log('\n--- ALL products count by business ---');
  const { data: allProds, error: apErr } = await supabase
    .from('products')
    .select('business_id, name')
    .eq('is_active', true);
  if (apErr) console.error('Error:', apErr);
  else {
    const counts = {};
    for (const p of allProds ?? []) {
      counts[p.business_id] = counts[p.business_id] || [];
      counts[p.business_id].push(p.name);
    }
    console.log(JSON.stringify(counts, null, 2));
  }

  // 9. Check if there are any messages after 2026-09-09 in conversation 05ae2db6
  console.log('\n--- Messages after 2026-09-09 in conversation 05ae2db6 ---');
  const { data: lateMsgs, error: lmErr } = await supabase
    .from('messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', '05ae2db6-a88a-4dd8-b08f-77725bce0757')
    .gte('created_at', '2026-09-09T21:36:57Z')
    .order('created_at', { ascending: true });
  if (lmErr) console.error('Error:', lmErr);
  else console.log(JSON.stringify(lateMsgs, null, 2));

  // 10. Count total messages in conversation
  console.log('\n--- Total message count in conversation 05ae2db6 ---');
  const { count, error: cntErr } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('conversation_id', '05ae2db6-a88a-4dd8-b08f-77725bce0757');
  if (cntErr) console.error('Error:', cntErr);
  else console.log(`Total messages: ${count}`);
}

main().catch(console.error);
