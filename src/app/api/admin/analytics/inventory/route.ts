import { NextResponse, type NextRequest } from 'next/server'
import { requirePageAuth } from '@/lib/auth'
import { getInventoryOverview } from '@/lib/analytics/queries'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await requirePageAuth()

    const { data: businesses } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1)

    const businessId = businesses?.[0]?.id
    if (!businessId) {
      return NextResponse.json(
        { error: 'No business found' },
        { status: 404 }
      )
    }

    const daysParam = new URL(req.url).searchParams.get('days')
    const days = daysParam ? Math.min(Math.max(parseInt(daysParam, 10) || 30, 7), 90) : 30

    const overview = await getInventoryOverview(businessId, days)

    return NextResponse.json({ overview })
  } catch (error) {
    console.error('Inventory analytics error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
