import { redirect } from 'next/navigation'
import { requirePageAuth } from '@/lib/auth'
import { PlatformAdminDashboard } from '@/components/platform/PlatformAdminDashboard'

export const dynamic = 'force-dynamic'

export default async function PlatformAdminPage() {
  const { user } = await requirePageAuth()

  const ownerId = process.env.PLATFORM_OWNER_ID
  if (!ownerId || user.id !== ownerId) {
    redirect('/dashboard')
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <PlatformAdminDashboard />
    </div>
  )
}
