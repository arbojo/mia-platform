import { requireAuth } from '@/lib/auth'
import { ConversationalOnboarding } from '@/components/onboarding/ConversationalOnboarding'

export default async function OnboardingPage() {
  const { supabase, user } = await requireAuth()

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  return (
    <div className="py-8">
      <ConversationalOnboarding
        userId={user.id}
        businessId={business?.id ?? null}
      />
    </div>
  )
}
