import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  getBusinessMemory,
  getSkillLevels,
  getVelocityHistory,
  getLatestVelocitySnapshot,
} from '@/lib/ai/memory'

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
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  const [memory, skills, velocityHistory, latestVelocity] = await Promise.all([
    getBusinessMemory(business.id),
    getSkillLevels(business.id),
    getVelocityHistory(business.id),
    getLatestVelocitySnapshot(business.id),
  ])

  return NextResponse.json({
    memory,
    skills,
    velocityHistory,
    latestVelocity,
  })
}
