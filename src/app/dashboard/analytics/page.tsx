import { redirect } from 'next/navigation'
import { requirePageAuth } from '@/lib/auth'
import { canBusinessUseInventoryHub } from '@/lib/system/edition'
import { AnalyticsClient } from './AnalyticsClient'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
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

  const hasInventory = await canBusinessUseInventoryHub(business.id)

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <AnalyticsClient businessId={business.id} hasInventory={hasInventory} />
    </div>
  )
}
