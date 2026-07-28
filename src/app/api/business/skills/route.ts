import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getSkillsSnapshot, getSkillGrowthHistory } from '@/lib/ai/skills'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const skillKey = searchParams.get('skill')

  if (skillKey) {
    const history = await getSkillGrowthHistory(business.id, skillKey)
    return NextResponse.json({ history })
  }

  const snapshot = await getSkillsSnapshot(business.id)
  return NextResponse.json(snapshot)
}
