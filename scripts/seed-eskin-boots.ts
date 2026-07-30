import { createAdminClient } from '../src/lib/supabase/admin'
import { ESKIN_BOOTS_DATA } from '../src/lib/seed/eskin-boots-data'

const BUSINESS_ID = 'a0000000-0000-0000-0000-000000000001'
const OWNER_ID = '2d5cd750-65ff-42bb-b994-0779534f92a8'

async function seed() {
  const supabase = createAdminClient()

  console.log('Checking if Eskin Boots already exists...')

  const { data: existing } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', BUSINESS_ID)
    .single()

  if (existing) {
    console.log('Eskin Boots already exists. Skipping.')
    process.exit(0)
  }

  console.log('Creating business...')

  const { error: businessError } = await supabase
    .from('businesses')
    .insert({
      id: BUSINESS_ID,
      owner_id: OWNER_ID,
      name: ESKIN_BOOTS_DATA.business.name,
      onboarding_status: ESKIN_BOOTS_DATA.business.onboarding_status,
    })

  if (businessError) {
    console.error('Failed to create business:', businessError.message)
    process.exit(1)
  }

  console.log('Creating brand identity...')

  const { error: brandError } = await supabase
    .from('brand_identities')
    .insert({
      business_id: BUSINESS_ID,
      ...ESKIN_BOOTS_DATA.brand,
    })

  if (brandError) {
    console.error('Failed to create brand:', brandError.message)
    process.exit(1)
  }

  console.log('Creating assistant...')

  const { data: assistant, error: assistantError } = await supabase
    .from('assistants')
    .insert({
      business_id: BUSINESS_ID,
      name: ESKIN_BOOTS_DATA.assistant.name,
      personality: ESKIN_BOOTS_DATA.assistant.personality,
      communication_style: ESKIN_BOOTS_DATA.assistant.communication_style,
      is_active: true,
    })
    .select()
    .single()

  if (assistantError) {
    console.error('Failed to create assistant:', assistantError.message)
    process.exit(1)
  }

  console.log(`Assistant created: ${assistant.id}`)

  console.log('Creating products...')

  const products = ESKIN_BOOTS_DATA.products.map((p) => ({
    business_id: BUSINESS_ID,
    name: p.name,
    price: p.price,
    description: p.description,
    benefits: p.benefits,
    restrictions: p.restrictions,
    is_active: true,
  }))

  const { error: productsError } = await supabase
    .from('products')
    .insert(products)

  if (productsError) {
    console.error('Failed to create products:', productsError.message)
    process.exit(1)
  }

  console.log(`Products created: ${products.length}`)

  console.log('Creating sales rules...')

  const rules = ESKIN_BOOTS_DATA.rules.map((r) => ({
    business_id: BUSINESS_ID,
    category: r.category,
    content: r.content,
    is_active: true,
  }))

  const { error: rulesError } = await supabase
    .from('sales_rules')
    .insert(rules)

  if (rulesError) {
    console.error('Failed to create rules:', rulesError.message)
    process.exit(1)
  }

  console.log(`Rules created: ${rules.length}`)

  console.log('Creating AI instructions...')

  const instructions = ESKIN_BOOTS_DATA.instructions.map((i) => ({
    business_id: BUSINESS_ID,
    instruction: i.instruction,
    priority: i.priority,
    is_active: true,
  }))

  const { error: instructionsError } = await supabase
    .from('ai_instructions')
    .insert(instructions)

  if (instructionsError) {
    console.error('Failed to create instructions:', instructionsError.message)
    process.exit(1)
  }

  console.log(`Instructions created: ${instructions.length}`)

  console.log('\n--- Seed Complete ---')
  console.log(`Business ID:    ${BUSINESS_ID}`)
  console.log(`Assistant ID:   ${assistant.id}`)
  console.log(`Products:       ${products.length}`)
  console.log(`Rules:          ${rules.length}`)
  console.log(`Instructions:   ${instructions.length}`)
  console.log('\nWidget URL:')
  console.log(`http://localhost:3000/widget?assistantId=${assistant.id}&name=Eskin`)
  console.log('\nEmbed code:')
  console.log(`<script src="http://localhost:3000/widget.js" data-assistant-id="${assistant.id}" data-name="Eskin"></script>`)
}

seed()
