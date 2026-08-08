import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('business_id')
  const category = searchParams.get('category')
  const search = searchParams.get('search')
  const mediaType = searchParams.get('media_type')
  const hasMedia = searchParams.get('has_media')

  if (!businessId) {
    return NextResponse.json({ error: 'business_id required' }, { status: 400 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', businessId)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let query = supabase
    .from('knowledge_items')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (category) {
    query = query.eq('category', category)
  }

  if (mediaType) {
    const validMediaTypes = ['image', 'testimonial', 'flyer', 'other']
    if (validMediaTypes.includes(mediaType)) {
      query = query.eq('media_type', mediaType)
    }
  }

  if (hasMedia === 'true') {
    query = query.not('image_url', 'is', null)
  }

  if (search) {
    query = query.or(`question.ilike.%${search}%,answer.ilike.%${search}%`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: data })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { business_id, category, question, answer, image_url, trigger_condition, media_type, product_id } = body as {
    business_id: string
    category: string
    question: string
    answer: string
    image_url?: string | null
    trigger_condition?: string | null
    media_type?: 'image' | 'testimonial' | 'flyer' | 'other'
    product_id?: string | null
  }

  if (!business_id || !category || !question || !answer) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const validMediaTypes = ['image', 'testimonial', 'flyer', 'other']
  if (media_type !== undefined && !validMediaTypes.includes(media_type)) {
    return NextResponse.json({ error: 'Invalid media_type' }, { status: 400 })
  }

  if (image_url && !trigger_condition && !product_id) {
    return NextResponse.json(
      { error: 'trigger_condition or product_id is required when attaching an image' },
      { status: 400 }
    )
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (product_id) {
    const { data: product } = await supabase
      .from('products')
      .select('id')
      .eq('id', product_id)
      .eq('business_id', business_id)
      .maybeSingle()

    if (!product) {
      return NextResponse.json(
        { error: 'product_id does not belong to this business' },
        { status: 400 }
      )
    }
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('knowledge_items')
    .insert({
      business_id,
      category,
      question,
      answer,
      image_url: image_url ?? null,
      trigger_condition: trigger_condition ?? null,
      media_type: media_type ?? 'other',
      product_id: product_id ?? null,
      source: 'manual',
      confidence: 'medium',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ item: data }, { status: 201 })
}
