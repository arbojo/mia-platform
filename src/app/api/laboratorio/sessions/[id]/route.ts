import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const admin = createAdminClient()

  const { data: session } = await admin
    .from('lab_sessions')
    .select('id, business_id')
    .eq('id', id)
    .maybeSingle()

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const { data: business } = await admin
    .from('businesses')
    .select('owner_id')
    .eq('id', session.business_id)
    .maybeSingle()

  if (!business || business.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await admin.from('lab_sessions').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ deleted: true })
}
