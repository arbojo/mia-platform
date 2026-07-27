import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

function formatTimeAgo(date: string | null): string {
  if (!date) return 'Sin interacciones'
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHrs = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHrs / 24)

  if (diffMin < 1) return 'Ahora mismo'
  if (diffMin < 60) return `Hace ${diffMin} min`
  if (diffHrs < 24) return `Hace ${diffHrs}h`
  if (diffDays === 1) return 'Ayer'
  return `Hace ${diffDays} días`
}

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

  let customerCount = 0
  let activeConversations = 0
  let lastInteraction: string | null = null

  if (business) {
    const assistantIds = business.assistants.map(
      (a: { id: string }) => a.id
    )

    const [customersResult, conversationsResult, lastMessageResult] =
      await Promise.all([
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', business.id),
        supabase
          .from('conversations')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active')
          .eq('type', 'live')
          .in('assistant_id', assistantIds),
        supabase
          .from('messages')
          .select('created_at, conversations!inner(assistant_id, type)')
          .eq('conversations.type', 'live')
          .in('conversations.assistant_id', assistantIds)
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
      ])

    customerCount = customersResult.count ?? 0
    activeConversations = conversationsResult.count ?? 0
    lastInteraction = lastMessageResult.data?.created_at ?? null
  }

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
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-violet-100 bg-gradient-to-br from-violet-50/50 to-white">
              <CardContent className="pt-6">
                <p className="text-3xl font-bold text-violet-700">{customerCount}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  clientes registrados
                </p>
              </CardContent>
            </Card>
            <Card className="border-violet-100 bg-gradient-to-br from-violet-50/50 to-white">
              <CardContent className="pt-6">
                <p className="text-3xl font-bold text-violet-700">{activeConversations}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  conversaciones activas
                </p>
              </CardContent>
            </Card>
            <Card className="border-violet-100 bg-gradient-to-br from-violet-50/50 to-white">
              <CardContent className="pt-6">
                <p className="text-3xl font-bold text-violet-700">
                  {formatTimeAgo(lastInteraction)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  última interacción
                </p>
              </CardContent>
            </Card>
          </div>

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
                    <div className="p-6 border border-violet-100 rounded-xl hover:border-violet-300 hover:shadow-md transition-all cursor-pointer bg-white">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-violet-600 rounded-full flex items-center justify-center shadow-sm">
                          <span className="text-xl font-bold text-white">
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
        </>
      )}
    </div>
  )
}
