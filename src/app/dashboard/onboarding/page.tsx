import { requirePageAuth } from '@/lib/auth'
import { OnboardingQuiz } from '@/components/onboarding/OnboardingQuiz'

export default async function OnboardingPage() {
  const { supabase, user } = await requirePageAuth()

  const r1 = await supabase
    .from('businesses')
    .select('id, onboarding_status')
    .eq('owner_id', user.id)
    .maybeSingle()
  let business: NonNullable<typeof r1.data> | null = r1.data

  if (!business) {
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const admin = createAdminClient()
      const { data: b2 } = await admin
        .from('businesses')
        .select('id, onboarding_status')
        .eq('owner_id', user.id)
        .maybeSingle()
      if (b2) business = b2
    } catch (e) {
      console.warn('[ONB_PAGE] admin fallback failed', e)
    }
  }

  return (
    <div className="py-8">
      <OnboardingQuiz
        userId={user.id}
        businessId={business?.id ?? null}
      />
    </div>
  )
}
