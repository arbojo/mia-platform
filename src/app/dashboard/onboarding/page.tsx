import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'

export default async function OnboardingPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  const stepMap: Record<string, number> = {
    created: 0,
    identity_completed: 1,
    business_completed: 2,
    products_completed: 3,
    rules_completed: 3,
    ready: 3,
  }

  const currentStep = business ? (stepMap[business.onboarding_status] ?? 0) : -1

  return (
    <div className="py-8">
      <OnboardingWizard
        userId={user.id}
        businessId={business?.id ?? null}
        initialStep={currentStep}
      />
    </div>
  )
}
