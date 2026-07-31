import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import {
  getActiveRecommendation,
  acceptRecommendation,
  rejectRecommendation,
} from '@/lib/ai/recommendation-engine'

export async function GET() {
  const { supabase, user } = await requireAuth()

  const { data: businessRecord } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!businessRecord) {
    return NextResponse.json({ recommendation: null })
  }

  const recommendation = await getActiveRecommendation(businessRecord.id)
  return NextResponse.json({ recommendation })
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await requireAuth()

  const { data: businessRecord } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!businessRecord) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 })
  }

  const body = await request.json()
  const { action, recommendationId, reason } = body

  if (!action || !recommendationId) {
    return NextResponse.json({ success: false, error: 'action and recommendationId required' }, { status: 400 })
  }

  if (action === 'accept') {
    const result = await acceptRecommendation(businessRecord.id, recommendationId)
    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }
    return NextResponse.json(result)
  }

  if (action === 'dismiss') {
    const result = await rejectRecommendation(businessRecord.id, recommendationId, reason)
    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }
    return NextResponse.json(result)
  }

  return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
}
