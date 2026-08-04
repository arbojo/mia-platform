import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const { supabase } = await requireAuth()

    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10) || 20, 50)
    const status = url.searchParams.get('status')

    let query = supabase
      .from('mia_signals')
      .select('id, type, priority, title, message, source, status, action_available, action_payload, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ signals: data ?? [] })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 },
    )
  }
}
