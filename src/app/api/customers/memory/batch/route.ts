import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  const { data: assistants } = await supabase
    .from('assistants')
    .select('id')
    .eq('business_id', business.id)

  const assistantIds = assistants?.map((a) => a.id) ?? []

  if (assistantIds.length === 0) {
    return NextResponse.json({ customers: [] })
  }

  const { data: conversations } = await supabase
    .from('conversations')
    .select('customer_id, assistant_id, customers(id, name, phone, memory)')
    .in('assistant_id', assistantIds)
    .eq('type', 'live')
    .not('customer_id', 'is', null)

  const seen = new Map<string, { id: string; name: string | null; phone: string | null; hasMemory: boolean; assistantId: string }>()

  for (const conv of conversations ?? []) {
    const cust = conv.customers as unknown as { id: string; name: string | null; phone: string | null; memory: unknown } | null
    if (!cust?.id) continue
    if (seen.has(cust.id)) continue

    seen.set(cust.id, {
      id: cust.id,
      name: cust.name,
      phone: cust.phone,
      hasMemory: cust.memory != null && typeof cust.memory === 'object' && Object.keys(cust.memory as Record<string, unknown>).length > 0,
      assistantId: conv.assistant_id,
    })
  }

  return NextResponse.json({ customers: [...seen.values()] })
}
