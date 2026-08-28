import { requirePageAuth } from '@/lib/auth'
import { OnboardingQuiz } from '@/components/onboarding/OnboardingQuiz'

export default async function OnboardingPage() {
  const { supabase, user } = await requirePageAuth()

  const { data: business } = await supabase
    .from('businesses')
    .select('id, onboarding_status')
    .eq('owner_id', user.id)
    .maybeSingle()

  return (
    <div className="py-8">
      <OnboardingQuiz
        userId={user.id}
        businessId={business?.id ?? null}
      />
    </div>
  )
}
