import { createClient } from '@/lib/supabase/client'

export async function getUserLandingPath(): Promise<string> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return '/login'

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  return business ? '/dashboard' : '/dashboard/onboarding'
}
