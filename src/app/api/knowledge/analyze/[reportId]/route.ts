import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: report, error: reportError } = await supabase
    .from('knowledge_analysis_reports')
    .select('*')
    .eq('id', reportId)
    .single()

  if (reportError || !report) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', report.business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: suggestions, error: suggestionsError } = await supabase
    .from('knowledge_suggestions')
    .select('*')
    .eq('report_id', reportId)
    .order('severity', { ascending: true })

  if (suggestionsError) {
    return NextResponse.json({ error: suggestionsError.message }, { status: 500 })
  }

  return NextResponse.json({ report, suggestions: suggestions ?? [] })
}
