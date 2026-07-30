import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ESKIN_BOOTS_DATA } from '@/lib/seed/eskin-boots-data'

const BUSINESS_ID = 'a0000000-0000-0000-0000-000000000001'

export async function POST() {
  try {
    const supabase = createAdminClient()

    const { data: existing } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', BUSINESS_ID)
      .single()

    if (existing) {
      return NextResponse.json({
        error: 'Eskin Boots already exists',
        business_id: BUSINESS_ID,
      }, { status: 409 })
    }

    const { data: userData } = await supabase.auth.admin.listUsers()
    const ownerUser = userData?.users?.[0]

    if (!ownerUser) {
      return NextResponse.json({ error: 'No users found in Supabase auth' }, { status: 500 })
    }

    const ownerId = ownerUser.id

    const { error: businessError } = await supabase
      .from('businesses')
      .insert({
        id: BUSINESS_ID,
        owner_id: ownerId,
        name: ESKIN_BOOTS_DATA.business.name,
        onboarding_status: ESKIN_BOOTS_DATA.business.onboarding_status,
      })

    if (businessError) {
      return NextResponse.json({ error: 'Failed to create business', details: businessError.message }, { status: 500 })
    }

    const { error: brandError } = await supabase
      .from('brand_identities')
      .insert({
        business_id: BUSINESS_ID,
        ...ESKIN_BOOTS_DATA.brand,
      })

    if (brandError) {
      return NextResponse.json({ error: 'Failed to create brand', details: brandError.message }, { status: 500 })
    }

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
      return NextResponse.json({ error: 'Failed to create assistant', details: assistantError.message }, { status: 500 })
    }

    const products = ESKIN_BOOTS_DATA.products.map((p) => ({
      business_id: BUSINESS_ID,
      name: p.name,
      price: p.price,
      description: p.description,
      benefits: p.benefits,
      restrictions: p.restrictions,
      is_active: true,
    }))

    const { error: productsError } = await supabase.from('products').insert(products)
    if (productsError) {
      return NextResponse.json({ error: 'Failed to create products', details: productsError.message }, { status: 500 })
    }

    const rules = ESKIN_BOOTS_DATA.rules.map((r) => ({
      business_id: BUSINESS_ID,
      category: r.category,
      content: r.content,
      is_active: true,
    }))

    const { error: rulesError } = await supabase.from('sales_rules').insert(rules)
    if (rulesError) {
      return NextResponse.json({ error: 'Failed to create rules', details: rulesError.message }, { status: 500 })
    }

    const instructions = ESKIN_BOOTS_DATA.instructions.map((i) => ({
      business_id: BUSINESS_ID,
      instruction: i.instruction,
      priority: i.priority,
      is_active: true,
    }))

    const { error: instructionsError } = await supabase.from('ai_instructions').insert(instructions)
    if (instructionsError) {
      return NextResponse.json({ error: 'Failed to create instructions', details: instructionsError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Eskin Boots seeded successfully',
      business_id: BUSINESS_ID,
      owner_id: ownerId,
      assistant_id: assistant.id,
      counts: {
        products: products.length,
        rules: rules.length,
        instructions: instructions.length,
      },
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
