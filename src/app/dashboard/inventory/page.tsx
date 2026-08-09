import { redirect } from 'next/navigation'
import { requirePageAuth } from '@/lib/auth'
import { InventoryAdmin } from '@/components/inventory/InventoryAdmin'

export const dynamic = 'force-dynamic'

export default async function InventoryAdminPage() {
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

  return <InventoryAdmin businessId={business.id} />
}
