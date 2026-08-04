import { requireAuth } from '@/lib/auth'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle2, AlertTriangle, Power, PowerOff, XCircle } from 'lucide-react'

const STATUS_MAP: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  draft: { label: 'Borrador', className: 'text-gray-500 bg-gray-100', icon: <XCircle className="h-3 w-3" /> },
  training: { label: 'Entrenando', className: 'text-amber-600 bg-amber-50', icon: <AlertTriangle className="h-3 w-3" /> },
  ready: { label: 'Lista', className: 'text-blue-600 bg-blue-50', icon: <CheckCircle2 className="h-3 w-3" /> },
  active: { label: 'Activa', className: 'text-emerald-600 bg-emerald-50', icon: <Power className="h-3 w-3" /> },
  inactive: { label: 'Inactiva', className: 'text-red-600 bg-red-50', icon: <PowerOff className="h-3 w-3" /> },
}

export default async function AssistantsPage() {
  const { supabase, user } = await requireAuth()

  const { data: business } = await supabase
    .from('businesses')
    .select('*, assistants(*)')
    .eq('owner_id', user.id)
    .single()

  const assistants = business?.assistants ?? []
  const assistantIds = assistants.map((a: { id: string }) => a.id)

  const { data: correctionCounts } = await supabase
    .from('learning_events')
    .select('assistant_id')
    .in('assistant_id', assistantIds.length > 0 ? assistantIds : ['none'])
    .in('status', ['approved', 'modified'])

  const counts = new Map<string, number>()
  for (const ev of correctionCounts ?? []) {
    counts.set(ev.assistant_id, (counts.get(ev.assistant_id) ?? 0) + 1)
  }

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
          <Button className="bg-olive-600 hover:bg-olive-700">
            Nueva asistente
          </Button>
        </Link>
      </div>

      {assistants.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-olive-200 rounded-xl">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Aún no tienes asistentes
          </h2>
          <p className="text-gray-600 mb-6">
            Crea tu primera asistente para comenzar a vender
          </p>
          <Link href="/dashboard/onboarding">
            <Button className="bg-olive-600 hover:bg-olive-700">
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
              status?: string
            }) => {
              const st = STATUS_MAP[assistant.status ?? 'draft'] ?? STATUS_MAP.draft
              return (
                <div
                  key={assistant.id}
                  className="p-6 border rounded-xl hover:border-olive-300 transition-colors"
                >
                  <Link href={`/dashboard/assistants/${assistant.id}`} className="block">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-olive-100 rounded-full flex items-center justify-center">
                        <span className="text-xl font-bold text-olive-600">
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
                        {counts.get(assistant.id) !== undefined && (
                          <p className="text-[11px] text-olive-600 mt-0.5">
                            {counts.get(assistant.id)} corrección{counts.get(assistant.id) !== 1 ? 'es' : ''} aprendida{counts.get(assistant.id) !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${st.className}`}>
                        {st.icon}
                        {st.label}
                      </span>
                    </div>
                  </Link>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/dashboard/assistants/${assistant.id}`}>
                      <Button size="sm" variant="outline">
                        Configurar
                      </Button>
                    </Link>
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
            }
          )}
        </div>
      )}
    </div>
  )
}
