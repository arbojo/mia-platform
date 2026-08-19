import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractMemorySuggestion } from '@/lib/ai/customer-memory'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { items } = body as {
    items: Array<{ customerId: string; assistantId: string }>
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'items array required' }, { status: 400 })
  }

  if (items.length > 50) {
    return NextResponse.json({ error: 'Maximum 50 items per batch' }, { status: 400 })
  }

  const suggestions = await Promise.all(
    items.map((item) => extractMemorySuggestion(item.customerId, item.assistantId))
  )

  return NextResponse.json({ suggestions })
}
