import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { invalidateConversationContext } from '@/lib/conversation/context'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: item, error } = await supabase
    .from('knowledge_items')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (error || !item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', item.business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ item })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: existing } = await supabase
    .from('knowledge_items')
    .select('business_id')
    .eq('id', id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', existing.business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { category, question, answer, confidence, image_url, trigger_condition, media_type, product_id, is_active } = body as {
    category?: string
    question?: string
    answer?: string
    confidence?: string
    image_url?: string | null
    trigger_condition?: string | null
    media_type?: 'image' | 'testimonial'
    product_id?: string | null
    is_active?: boolean
  }

  const validMediaTypes = ['image', 'testimonial']
  if (media_type !== undefined && !validMediaTypes.includes(media_type)) {
    return NextResponse.json({ error: 'Invalid media_type' }, { status: 400 })
  }

  if (is_active !== undefined && typeof is_active !== 'boolean') {
    return NextResponse.json({ error: 'Invalid is_active' }, { status: 400 })
  }

  const { data: existingRow } = await supabase
    .from('knowledge_items')
    .select('*')
    .eq('id', id)
    .single()

  if (product_id !== undefined && product_id !== null) {
    const { data: product } = await supabase
      .from('products')
      .select('id')
      .eq('id', product_id)
      .eq('business_id', existing.business_id)
      .maybeSingle()

    if (!product) {
      return NextResponse.json(
        { error: 'product_id does not belong to this business' },
        { status: 400 }
      )
    }
  }

  const admin = createAdminClient()

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (category !== undefined) updates.category = category
  if (question !== undefined) updates.question = question
  if (answer !== undefined) updates.answer = answer
  if (confidence !== undefined) updates.confidence = confidence
  if (image_url !== undefined) updates.image_url = image_url
  if (trigger_condition !== undefined) updates.trigger_condition = trigger_condition
  if (media_type !== undefined) updates.media_type = media_type
  if (product_id !== undefined) updates.product_id = product_id
  if (is_active !== undefined) updates.is_active = is_active

  const { data, error } = await admin
    .from('knowledge_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (existingRow) {
    await admin.from('knowledge_versions').insert({
      business_id: existing.business_id,
      entity_type: 'knowledge_item',
      entity_id: id,
      previous_value: existingRow,
      new_value: data,
      changed_by: user.id,
      change_source: 'manual',
    })
  }

  invalidateConversationContext(existing.business_id)

  return NextResponse.json({ item: data })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: existing } = await supabase
    .from('knowledge_items')
    .select('business_id')
    .eq('id', id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', existing.business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { error } = await admin
    .from('knowledge_items')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  invalidateConversationContext(existing.business_id)

  return NextResponse.json({ success: true })
}
