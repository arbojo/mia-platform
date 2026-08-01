import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AssistantConfig } from './AssistantConfig'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function AssistantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, user } = await requireAuth()

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!business) redirect('/dashboard/onboarding')

  const { data: assistant } = await supabase
    .from('assistants')
    .select('*')
    .eq('id', id)
    .single()

  if (!assistant) redirect('/dashboard/assistants')

  const admin = createAdminClient()

  const [productsCount, rulesCount, knowledgeCount, lessonsCount, brandCount] = await Promise.all([
    admin.from('products').select('id', { count: 'exact', head: true }).eq('business_id', business.id).eq('is_active', true),
    admin.from('sales_rules').select('id', { count: 'exact', head: true }).eq('business_id', business.id).eq('is_active', true),
    admin.from('knowledge_items').select('id', { count: 'exact', head: true }).eq('business_id', business.id).eq('is_active', true),
    admin.from('learning_events').select('id', { count: 'exact', head: true }).eq('assistant_id', id).in('status', ['approved', 'modified']),
    admin.from('brand_identities').select('id', { count: 'exact', head: true }).eq('business_id', business.id),
  ])

  const readiness = {
    hasBrand: (brandCount.count ?? 0) > 0,
    hasProducts: (productsCount.count ?? 0) > 0,
    hasRules: (rulesCount.count ?? 0) > 0,
    hasKnowledge: (knowledgeCount.count ?? 0) > 0,
    hasTraining: (lessonsCount.count ?? 0) > 0,
  }

  return (
    <AssistantConfig assistant={assistant} readiness={readiness} />
  )
}
