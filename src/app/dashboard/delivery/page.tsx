import { redirect } from 'next/navigation'
import { requirePageAuth } from '@/lib/auth'
import { canBusinessUseDeliveryHub } from '@/lib/system/edition'
import { DeliveryAdmin } from '@/components/delivery/DeliveryAdmin'
import { DeliveryPaywall } from '@/components/delivery/DeliveryPaywall'

export const dynamic = 'force-dynamic'

export default async function DeliveryAdminPage() {
  const { supabase, user } = await requirePageAuth()

  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('owner_id', user.id)
    .limit(1)

  const business = businesses?.[0]

  if (!business) {
    redirect('/dashboard/onboarding')
  }

  if (!(await canBusinessUseDeliveryHub(business.id))) {
    return <DeliveryPaywall />
  }

  return <DeliveryAdmin businessId={business.id} />
}
