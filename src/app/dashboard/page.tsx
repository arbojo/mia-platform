import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('*, assistants(*)')
    .eq('owner_id', user.id)
    .single()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Hola, {user.user_metadata?.full_name ?? user.email?.split('@')[0]}
        </h1>
        <p className="text-gray-600">
          Bienvenido a tu panel de MIA
        </p>
      </div>

      {!business ? (
        <div className="text-center py-12 border-2 border-dashed border-violet-200 rounded-xl">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            ¡Comienza con MIA!
          </h2>
          <p className="text-gray-600 mb-6">
            Primero necesitas crear tu negocio y configurar tu asistente
          </p>
          <Link href="/dashboard/onboarding">
            <Button className="bg-violet-600 hover:bg-violet-700">
              Presentar mi asistente
            </Button>
          </Link>
        </div>
      ) : business.assistants.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-violet-200 rounded-xl">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Crea tu primera asistente
          </h2>
          <p className="text-gray-600 mb-6">
            Vamos a configurar a tu asistente paso a paso
          </p>
          <Link href="/dashboard/onboarding">
            <Button className="bg-violet-600 hover:bg-violet-700">
              Crear asistente
            </Button>
          </Link>
        </div>
      ) : (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Tus asistentes
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {business.assistants.map(
              (assistant: {
                id: string
                name: string
                personality: Record<string, number>
                communication_style: string
              }) => (
                <Link
                  key={assistant.id}
                  href={`/dashboard/assistants/${assistant.id}`}
                >
                  <div className="p-6 border rounded-xl hover:border-violet-300 transition-colors cursor-pointer">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center">
                        <span className="text-xl font-bold text-violet-600">
                          {assistant.name[0]}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {assistant.name}
                        </h3>
                        <p className="text-sm text-gray-500 capitalize">
                          {assistant.communication_style}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/dashboard/assistants/${assistant.id}/training`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button size="sm" variant="outline">
                          Entrenar
                        </Button>
                      </Link>
                      <Link
                        href={`/dashboard/assistants/${assistant.id}/products`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button size="sm" variant="outline">
                          Productos
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Link>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}
