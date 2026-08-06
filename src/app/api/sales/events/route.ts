import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { handleApiError } from '@/lib/api-error'

export async function GET(request: NextRequest) {
  try {
    const { supabase } = await requireAuth()

    const url = new URL(request.url)
    const businessId = url.searchParams.get('business_id')
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 100)

    if (!businessId) {
      return NextResponse.json({ error: 'business_id es requerido' }, { status: 400 })
    }

    let query = supabase
      .from('sales_events')
      .select('id, event_type, amount, product_id, metadata, conversation_id, created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(limit)

    const eventType = url.searchParams.get('event_type')
    if (eventType) {
      query = query.eq('event_type', eventType)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ events: data ?? [] })
  } catch (err) {
    return handleApiError(err)
  }
}
