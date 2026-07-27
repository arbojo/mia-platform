import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { KnowledgeStudio } from '@/components/studio/KnowledgeStudio'

export default async function KnowledgeStudioPage() {
  const { supabase, user } = await requireAuth()

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    redirect('/dashboard/onboarding')
  }

  const { data: latestReport } = await supabase
    .from('knowledge_analysis_reports')
    .select('*')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  let suggestions: unknown[] = []
  if (latestReport) {
    const { data } = await supabase
      .from('knowledge_suggestions')
      .select('*')
      .eq('report_id', latestReport.id)
      .order('severity', { ascending: true })
    suggestions = data ?? []
  }

  return (
    <KnowledgeStudio
      businessId={business.id}
      initialReport={latestReport}
      initialSuggestions={suggestions as Array<{
        id: string
        type: string
        severity: string
        title: string
        description: string
        suggested_category: string | null
        suggested_question: string | null
        suggested_answer: string | null
        suggested_rule_content: string | null
        status: string
      }>}
    />
  )
}
