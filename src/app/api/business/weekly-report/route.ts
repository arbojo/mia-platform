import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateWeeklyReport, getLatestWeeklyReport, getWeeklyReportsHistory } from '@/lib/ai/weekly-report'

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

  const [latest, history] = await Promise.all([
    getLatestWeeklyReport(business.id),
    getWeeklyReportsHistory(business.id),
  ])

  return NextResponse.json({ latest, history })
}

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

  const result = await generateWeeklyReport(business.id)

  return NextResponse.json(result)
}
