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
  console.log('=== E2E Test Neurofeet Contamination Check ===\n');

  // 1. Get Vitanova business ID
  console.log('--- Businesses ---');
  const { data: businesses, error: bizErr } = await supabase
    .from('businesses')
    .select('id, name, owner_id');
  if (bizErr) console.error('Error:', bizErr);
  else console.log(JSON.stringify(businesses, null, 2));

  const vitanovaBiz = businesses?.find(b => b.name.toLowerCase().includes('vitanova'));
  if (!vitanovaBiz) {
    console.error('Vitanova business not found!');
    return;
  }
  console.log(`\nVitanova business ID: ${vitanovaBiz.id}\n`);

  // 2. Search products for E2E or Neurofeet
  console.log('--- Products containing "E2E" or "Neurofeet" ---');
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, business_id, name, description, is_active')
    .or('name.ilike.%E2E%,name.ilike.%Neurofeet%,description.ilike.%E2E%,description.ilike.%Neurofeet%');
  if (prodErr) console.error('Error:', prodErr);
  else console.log(JSON.stringify(products, null, 2));

  // 3. All Vitanova products
  console.log('\n--- All Vitanova products ---');
  const { data: allProds, error: allErr } = await supabase
    .from('products')
    .select('id, business_id, name, is_active')
    .eq('business_id', vitanovaBiz.id)
    .order('name');
  if (allErr) console.error('Error:', allErr);
  else console.log(JSON.stringify(allProds, null, 2));

  // 4. Search knowledge_items for E2E or Neurofeet (using question/answer columns)
  console.log('\n--- Knowledge items containing "E2E" or "Neurofeet" ---');
  const { data: knowledge, error: knowErr } = await supabase
    .from('knowledge_items')
    .select('id, business_id, question, answer, category, trigger_condition')
    .eq('business_id', vitanovaBiz.id)
    .or('question.ilike.%E2E%,question.ilike.%Neurofeet%,answer.ilike.%E2E%,answer.ilike.%Neurofeet%,trigger_condition.ilike.%E2E%,trigger_condition.ilike.%Neurofeet%');
  if (knowErr) console.error('Error:', knowErr);
  else console.log(JSON.stringify(knowledge, null, 2));

  // 5. Knowledge items with nail/fungus triggers
  console.log('\n--- Knowledge items with nail/fungus triggers ---');
  const { data: nailKnow, error: nailErr } = await supabase
    .from('knowledge_items')
    .select('id, business_id, question, answer, category, trigger_condition')
    .eq('business_id', vitanovaBiz.id)
    .or('trigger_condition.ilike.%uña%,trigger_condition.ilike.%hongo%,trigger_condition.ilike.%onicomicosis%,trigger_condition.ilike.%uñas%,answer.ilike.%uña%,answer.ilike.%hongo%');
  if (nailErr) console.error('Error:', nailErr);
  else console.log(JSON.stringify(nailKnow, null, 2));

  // 6. Check customers table for David
  console.log('\n--- Customer David ---');
  const { data: customers, error: custErr } = await supabase
    .from('customers')
    .select('id, business_id, name, phone, memory')
    .eq('business_id', vitanovaBiz.id)
    .or('name.ilike.%David%,name.ilike.%david%,phone.ilike.%75273714315398%');
  if (custErr) console.error('Error:', custErr);
  else {
    for (const c of customers) {
      console.log(`\nCustomer: ${c.name} (${c.phone})`);
      console.log(`Memory raw:`, JSON.stringify(c.memory, null, 2));
      
      const memory = c.memory;
      if (memory && typeof memory === 'object') {
        // Check evidence
        if (memory.evidence) {
          const evidence = memory.evidence;
          if (evidence.items && Array.isArray(evidence.items)) {
            console.log(`Evidence items count: ${evidence.items.length}`);
            const e2eEvidence = evidence.items.filter(e => 
              JSON.stringify(e).toLowerCase().includes('e2e') || 
              JSON.stringify(e).toLowerCase().includes('neurofeet')
            );
            if (e2eEvidence.length > 0) {
              console.log('E2E/Neurofeet evidence FOUND:', JSON.stringify(e2eEvidence, null, 2));
            } else {
              console.log('No E2E/Neurofeet in evidence items');
            }
            // Show last 3 evidence items
            const last3 = evidence.items.slice(-3);
            console.log('Last 3 evidence items:', JSON.stringify(last3, null, 2));
          }
          if (evidence.state) {
            console.log('Evidence state:', JSON.stringify(evidence.state, null, 2));
          }
        }
        // Check questions (last 5 user messages)
        if (memory.questions && Array.isArray(memory.questions)) {
          console.log(`Questions count: ${memory.questions.length}`);
          console.log('Questions:', JSON.stringify(memory.questions, null, 2));
        }
        // Check interests
        if (memory.interests) {
          console.log('Interests:', JSON.stringify(memory.interests, null, 2));
        }
        // Check summary
        if (memory.summary) {
          console.log('Summary:', memory.summary);
        }
      }
    }
  }

  // 7. Check conversations for the specific ID
  console.log('\n--- Conversation 05ae2db6 ---');
  const { data: convs, error: convErr } = await supabase
    .from('conversations')
    .select('id, assistant_id, customer_id, type, status, created_at')
    .eq('id', '05ae2db6-a88a-4dd8-b08f-77725bce0757');
  if (convErr) console.error('Error:', convErr);
  else console.log(JSON.stringify(convs, null, 2));

  // 8. Get ALL conversations for David's customer
  if (customers?.[0]?.id) {
    console.log(`\n--- All conversations for customer ${customers[0].id} ---`);
    const { data: custConvs, error: ccErr } = await supabase
      .from('conversations')
      .select('id, type, status, created_at')
      .eq('customer_id', customers[0].id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (ccErr) console.error('Error:', ccErr);
    else console.log(JSON.stringify(custConvs, null, 2));

    // 9. Get messages from the conversation
    if (custConvs && custConvs.length > 0) {
      console.log(`\n--- Messages from latest conversation ${custConvs[0].id} ---`);
      const { data: msgs, error: msgErr } = await supabase
        .from('messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', custConvs[0].id)
        .order('created_at', { ascending: true });
      if (msgErr) console.error('Error:', msgErr);
      else console.log(JSON.stringify(msgs, null, 2));
    }
  }

  // 10. Search ALL knowledge items globally for E2E (across all businesses)
  console.log('\n--- ALL knowledge items containing "E2E" (all businesses) ---');
  const { data: allE2E, error: e2eErr } = await supabase
    .from('knowledge_items')
    .select('id, business_id, question, answer, category, trigger_condition')
    .or('question.ilike.%E2E%,answer.ilike.%E2E%,trigger_condition.ilike.%E2E%');
  if (e2eErr) console.error('Error:', e2eErr);
  else console.log(JSON.stringify(allE2E, null, 2));

  // 11. Search ALL products globally for E2E
  console.log('\n--- ALL products containing "E2E" (all businesses) ---');
  const { data: allE2EProds, error: e2pErr } = await supabase
    .from('products')
    .select('id, business_id, name, is_active')
    .or('name.ilike.%E2E%,description.ilike.%E2E%');
  if (e2pErr) console.error('Error:', e2pErr);
  else console.log(JSON.stringify(allE2EProds, null, 2));

  // 12. Search ALL knowledge items for Neurofeet
  console.log('\n--- ALL knowledge items containing "Neurofeet" (all businesses) ---');
  const { data: allNeuro, error: neuroErr } = await supabase
    .from('knowledge_items')
    .select('id, business_id, question, answer, category, trigger_condition')
    .or('question.ilike.%Neurofeet%,answer.ilike.%Neurofeet%,trigger_condition.ilike.%Neurofeet%');
  if (neuroErr) console.error('Error:', neuroErr);
  else console.log(JSON.stringify(allNeuro, null, 2));

  // 13. Search ALL products for Neurofeet
  console.log('\n--- ALL products containing "Neurofeet" (all businesses) ---');
  const { data: allNeuroProds, error: npErr } = await supabase
    .from('products')
    .select('id, business_id, name, is_active')
    .or('name.ilike.%Neurofeet%,description.ilike.%Neurofeet%');
  if (npErr) console.error('Error:', npErr);
  else console.log(JSON.stringify(allNeuroProds, null, 2));
}

main().catch(console.error);
