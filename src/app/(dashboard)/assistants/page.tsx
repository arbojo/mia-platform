import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function AssistantsPage() {
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

  const assistants = business?.assistants ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asistentes</h1>
          <p className="text-gray-600">
            Gestiona tus asistentes de ventas
          </p>
        </div>
        <Link href="/dashboard/onboarding">
          <Button className="bg-violet-600 hover:bg-violet-700">
            Nueva asistente
          </Button>
        </Link>
      </div>

      {assistants.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-violet-200 rounded-xl">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Aún no tienes asistentes
          </h2>
          <p className="text-gray-600 mb-6">
            Crea tu primera asistente para comenzar a vender
          </p>
          <Link href="/dashboard/onboarding">
            <Button className="bg-violet-600 hover:bg-violet-700">
              Crear asistente
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {assistants.map(
            (assistant: {
              id: string
              name: string
              personality: Record<string, number>
              communication_style: string
            }) => (
              <div
                key={assistant.id}
                className="p-6 border rounded-xl hover:border-violet-300 transition-colors"
              >
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
                <div className="flex flex-wrap gap-2">
                  <Link href={`/dashboard/assistants/${assistant.id}/training`}>
                    <Button size="sm" variant="outline">
                      Entrenar
                    </Button>
                  </Link>
                  <Link href={`/dashboard/assistants/${assistant.id}/products`}>
                    <Button size="sm" variant="outline">
                      Productos
                    </Button>
                  </Link>
                  <Link href={`/dashboard/assistants/${assistant.id}/rules`}>
                    <Button size="sm" variant="outline">
                      Reglas
                    </Button>
                  </Link>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
