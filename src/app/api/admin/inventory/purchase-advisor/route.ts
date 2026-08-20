import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generatePurchaseRecommendations } from '@/lib/inventory/purchase-advisor'
import { runMarginAudit } from '@/lib/analytics/margin-audit'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('business_id')

  if (!businessId) {
    return NextResponse.json({ error: 'business_id required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: business } = await admin
    .from('businesses')
    .select('id')
    .eq('id', businessId)
    .maybeSingle()

  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  try {
    const budgetStatus = await generatePurchaseRecommendations(businessId)
    return NextResponse.json(budgetStatus)
  } catch (error) {
    console.error('[purchase-advisor] Failed:', error)
    return NextResponse.json({ error: 'Failed to generate recommendations' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { business_id } = body as { business_id?: string }

  if (!business_id) {
    return NextResponse.json({ error: 'business_id required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: business } = await admin
    .from('businesses')
    .select('id')
    .eq('id', business_id)
    .maybeSingle()

  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  try {
    const budgetStatus = await generatePurchaseRecommendations(business_id)

    await runMarginAudit(business_id)

    return NextResponse.json({
      status: 'completed',
      ...budgetStatus,
    })
  } catch (error) {
    console.error('[purchase-advisor] Failed:', error)
    return NextResponse.json({ error: 'Failed to generate recommendations' }, { status: 500 })
  }
}
