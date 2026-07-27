import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { KnowledgeCenter } from '@/components/knowledge/KnowledgeCenter'

export default async function KnowledgePage() {
  const { supabase, user } = await requireAuth()

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    redirect('/dashboard/onboarding')
  }

  const [knowledgeResult, instructionsResult] = await Promise.all([
    supabase
      .from('knowledge_items')
      .select('*')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('ai_instructions')
      .select('*')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .order('priority', { ascending: false }),
  ])

  return (
    <KnowledgeCenter
      businessId={business.id}
      initialKnowledge={knowledgeResult.data ?? []}
      initialInstructions={instructionsResult.data ?? []}
    />
  )
}
