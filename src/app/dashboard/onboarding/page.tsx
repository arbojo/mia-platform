import { requirePageAuth } from '@/lib/auth'
import { ConversationalOnboarding } from '@/components/onboarding/ConversationalOnboarding'

export default async function OnboardingPage() {
  const { supabase, user } = await requirePageAuth()

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  return (
    <div className="py-8">
      <ConversationalOnboarding
        userId={user.id}
        businessId={business?.id ?? null}
      />
    </div>
  )
}
