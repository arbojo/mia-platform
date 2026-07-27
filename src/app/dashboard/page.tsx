import { requireAuth } from '@/lib/auth'
import { getDashboardData } from '@/lib/dashboard/queries'
import { EmployeeStatusCard } from '@/components/dashboard/EmployeeStatusCard'
import { TodaysActivity } from '@/components/dashboard/TodaysActivity'
import { DailyReport } from '@/components/dashboard/DailyReport'
import { NeedsFromYou } from '@/components/dashboard/NeedsFromYou'
import { ConversationTimeline } from '@/components/dashboard/ConversationTimeline'
import { BusinessHealth } from '@/components/dashboard/BusinessHealth'
import { QuickActions } from '@/components/dashboard/QuickActions'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const { supabase, user } = await requireAuth()

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, onboarding_status, assistants(id, name, is_active)')
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Hola, {user.user_metadata?.full_name ?? user.email?.split('@')[0]}
          </h1>
          <p className="text-gray-600">Bienvenido a tu Operaciones MIA</p>
        </div>
        <div className="py-12 text-center border-2 border-dashed border-violet-200 rounded-xl">
          <h2 className="mb-2 text-xl font-semibold text-gray-900">
            Comienza con MIA!
          </h2>
          <p className="mb-6 text-gray-600">
            Primero necesitas crear tu negocio y configurar a tu asistente
          </p>
          <Link href="/dashboard/onboarding">
            <Button className="bg-violet-600 hover:bg-violet-700">
              Presentar mi asistente
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  if (business.assistants.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Hola, {user.user_metadata?.full_name ?? user.email?.split('@')[0]}
          </h1>
          <p className="text-gray-600">Bienvenido a tu Operaciones MIA</p>
        </div>
        <div className="py-12 text-center border-2 border-dashed border-violet-200 rounded-xl">
          <h2 className="mb-2 text-xl font-semibold text-gray-900">
            Crea tu primera asistente
          </h2>
          <p className="mb-6 text-gray-600">
            Vamos a configurar a tu asistente paso a paso
          </p>
          <Link href="/dashboard/onboarding">
            <Button className="bg-violet-600 hover:bg-violet-700">
              Crear asistente
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const data = await getDashboardData(supabase, business.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">
          Buenos dias, {user.user_metadata?.full_name ?? user.email?.split('@')[0]}
        </h1>
        <p className="text-sm text-zinc-500">Resumen operativo de MIA</p>
      </div>

      <EmployeeStatusCard status={data.employeeStatus} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TodaysActivity metrics={data.todaysActivity} />
        </div>
        <QuickActions />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DailyReport report={data.dailyReport} />
        <NeedsFromYou data={data.needsFromYou} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ConversationTimeline data={data.conversationTimeline} />
        <BusinessHealth data={data.businessHealth} />
      </div>
    </div>
  )
}
