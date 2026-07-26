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

  let { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    const { data: newBusiness, error } = await supabase
      .from('businesses')
      .insert({
        owner_id: user.id,
        name: 'Mi negocio',
      })
      .select()
      .single()

    if (error || !newBusiness) {
      redirect('/dashboard')
    }

    business = newBusiness
  }

  const stepMap: Record<string, number> = {
    created: 0,
    identity_completed: 1,
    business_completed: 2,
    products_completed: 3,
    rules_completed: 3,
    ready: 3,
  }

  const currentStep = stepMap[business.onboarding_status] ?? 0

  return (
    <div className="py-8">
      <OnboardingWizard businessId={business.id} initialStep={currentStep} />
    </div>
  )
}
