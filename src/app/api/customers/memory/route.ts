import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCustomerMemory, extractAndSaveCustomerMemory } from '@/lib/ai/customer-memory'
import { invalidateSystemContext } from '@/lib/cache/invalidator'

async function verifyCustomerAccess(customerId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .maybeSingle()
  return customer !== null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const customerId = searchParams.get('customerId')

  if (!customerId) {
    return NextResponse.json({ error: 'customerId required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const hasAccess = await verifyCustomerAccess(customerId)
  if (!hasAccess) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  const memory = await getCustomerMemory(customerId)
  return NextResponse.json({ memory })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { customerId, assistantId } = body

  if (!customerId || !assistantId) {
    return NextResponse.json({ error: 'customerId and assistantId required' }, { status: 400 })
  }

  const hasAccess = await verifyCustomerAccess(customerId)
  if (!hasAccess) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  const { data: assistant } = await supabase
    .from('assistants')
    .select('business_id')
    .eq('id', assistantId)
    .single()

  const memory = await extractAndSaveCustomerMemory(customerId, assistantId)
  if (assistant?.business_id) {
    invalidateSystemContext(assistant.business_id)
  }
  return NextResponse.json({ memory })
}
