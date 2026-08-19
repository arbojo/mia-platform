import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { approveMemorySuggestion } from '@/lib/ai/customer-memory'
import { invalidateSystemContext } from '@/lib/cache/invalidator'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { customerId, memory } = body as {
    customerId: string
    memory: {
      interests: string[]
      objections: string[]
      questions: string[]
      preferences: string[]
      summary: string
      lastInteraction: string | null
    }
  }

  if (!customerId || !memory) {
    return NextResponse.json({ error: 'customerId and memory required' }, { status: 400 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!business) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await approveMemorySuggestion(customerId, memory)

  if (business.id) {
    invalidateSystemContext(business.id)
  }

  return NextResponse.json({ success: true })
}
