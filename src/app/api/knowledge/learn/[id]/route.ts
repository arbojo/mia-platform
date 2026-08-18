import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { invalidateSystemContext } from '@/lib/cache/invalidator'

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

  const { data: report } = await supabase
    .from('learning_reports')
    .select('*')
    .eq('id', id)
    .single()

  if (!report) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', report.business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ report })
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

  const { data: report } = await supabase
    .from('learning_reports')
    .select('business_id, extracted_products, extracted_knowledge, extracted_rules')
    .eq('id', id)
    .single()

  if (!report) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', report.business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { action, itemType, itemIndex } = body as {
    action: 'approve' | 'reject'
    itemType: 'product' | 'knowledge' | 'rule'
    itemIndex: number
  }

  if (!action || !itemType || itemIndex === undefined) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = createAdminClient()

  const extractedKey = `extracted_${itemType === 'product' ? 'products' : itemType === 'knowledge' ? 'knowledge' : 'rules'}`
  const items = (report as Record<string, unknown>)[extractedKey] as Array<Record<string, unknown>>
  if (!items || !items[itemIndex]) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  if (action === 'approve') {
    const item = items[itemIndex]

    if (itemType === 'product') {
      await admin.from('products').insert({
        business_id: report.business_id,
        name: item.name as string,
        price: item.price as number | null,
        description: item.description as string | null,
        benefits: item.benefits as string | null,
        faq: item.faq ?? '[]',
        restrictions: item.restrictions as string | null,
      })
    } else if (itemType === 'knowledge') {
      await admin.from('knowledge_items').insert({
        business_id: report.business_id,
        category: item.category as string,
        question: item.question as string,
        answer: item.answer as string,
        source: 'document',
        confidence: (item.confidence as number) >= 70 ? 'high' : 'medium',
      })
    } else if (itemType === 'rule') {
      await admin.from('sales_rules').insert({
        business_id: report.business_id,
        category: item.category as string,
        content: item.content as string,
      })
    }
  }

  items[itemIndex] = { ...items[itemIndex], _status: action === 'approve' ? 'approved' : 'rejected' }

  await admin
    .from('learning_reports')
    .update({ [extractedKey]: items })
    .eq('id', id)

  if (action === 'approve') {
    invalidateSystemContext(report.business_id)
  }

  return NextResponse.json({ success: true })
}
