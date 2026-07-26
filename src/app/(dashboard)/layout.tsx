import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/dashboard/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
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

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        {business?.onboarding_status !== 'ready' && !window.location.pathname.includes('onboarding') ? (
          <div className="mb-6 p-4 bg-violet-50 border border-violet-200 rounded-lg">
            <p className="text-violet-800">
              <strong>¡Bienvenido a MIA!</strong> Parece que aún no has completado
              la configuración de tu asistente.{' '}
              <a href="/dashboard/onboarding" className="underline font-medium">
                Continuar configuración
              </a>
            </p>
          </div>
        ) : null}
        {children}
      </main>
    </div>
  )
}
