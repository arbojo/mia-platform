import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const OWNER_ID = 'e8031a2c-2c0b-4e06-a7d1-837a9423afdc'

async function main() {
  console.log('=== Creating Vitanova Business ===\n')

  // 1. Create business
  const { data: biz, error: bizErr } = await supabase
    .from('businesses')
    .insert({
      owner_id: OWNER_ID,
      name: 'Vitanova'
    })
    .select()
    .single()

  if (bizErr) { console.error('Business error:', bizErr); return }
  console.log(`✅ Business created: ${biz.id} — ${biz.name}`)

  // 2. Create brand identity
  const { data: brand, error: brandErr } = await supabase
    .from('brand_identities')
    .insert({
      business_id: biz.id,
      business_name: 'Vitanova',
      tagline: 'Tecnologia que impulsa tu negocio',
      target_customers: 'Empresas y emprendedores que buscan soluciones tecnologicas innovadoras',
      differentiators: 'Soluciones personalizadas con inteligencia artificial integrada',
      elevator_pitch: 'Vitanova ofrece soluciones tecnologicas innovadoras impulsadas por IA para impulsar tu negocio.',
      tone_of_voice: 'Profesional, cercano e innovador'
    })
    .select()
    .single()

  if (brandErr) { console.error('Brand error:', brandErr); return }
  console.log(`✅ Brand identity created for Vitanova`)

  // 3. Create assistant
  const { data: asst, error: asstErr } = await supabase
    .from('assistants')
    .insert({
      business_id: biz.id,
      name: 'Vita',
      is_active: true,
      personality: { warmth: 70, formality: 60, humor: 30, sales_aggressiveness: 40 },
      communication_style: 'warm'
    })
    .select()
    .single()

  if (asstErr) { console.error('Assistant error:', asstErr); return }
  console.log(`✅ Assistant created: ${asst.id} — ${asst.name}`)

  console.log('\n=== Vitanova Setup Complete ===')
  console.log(`Business ID: ${biz.id}`)
  console.log(`Assistant ID: ${asst.id}`)
}

main().catch(console.error)
