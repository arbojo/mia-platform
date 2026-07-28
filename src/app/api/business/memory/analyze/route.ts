import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  analyzeConversationPatterns,
  upsertBusinessMemory,
  calculateSkillLevels,
  calculateLearningVelocity,
} from '@/lib/ai/memory'

export async function POST() {
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

  const [patterns, skills, velocity] = await Promise.all([
    analyzeConversationPatterns(business.id),
    calculateSkillLevels(business.id),
    calculateLearningVelocity(business.id),
  ])

  const memoryItems = patterns.length > 0
    ? await upsertBusinessMemory(business.id, patterns)
    : []

  return NextResponse.json({
    memoryCreated: memoryItems.length,
    patternsDetected: patterns.length,
    skillsUpdated: skills.length,
    velocity,
  })
}
