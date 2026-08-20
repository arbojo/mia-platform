import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runMarginAudit } from '@/lib/analytics/margin-audit'

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
    const result = await runMarginAudit(business_id)

    return NextResponse.json({
      status: 'completed',
      margins_count: result.margins.length,
      anomalies_count: result.anomalies.length,
      insights_created: result.insights_created,
      margins: result.margins,
      anomalies: result.anomalies,
    })
  } catch (error) {
    console.error('[margin-audit] Failed:', error)
    return NextResponse.json({ error: 'Audit failed' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('business_id')

  if (!businessId) {
    return NextResponse.json({ error: 'business_id required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: insights } = await admin
    .from('ai_insights')
    .select('*')
    .eq('business_id', businessId)
    .eq('insight_type', 'product_alert')
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({ insights: insights ?? [] })
}
