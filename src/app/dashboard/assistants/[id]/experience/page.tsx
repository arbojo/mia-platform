import { requirePageAuth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { SuggestionList } from '@/components/experience/SuggestionList'

export default async function ExperiencePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase } = await requirePageAuth()

  const { data: assistant } = await supabase
    .from('assistants')
    .select('*')
    .eq('id', id)
    .single()

  if (!assistant) {
    notFound()
  }

  const { data: suggestions } = await supabase
    .from('experience_suggestions')
    .select('*, parent:experience_memory(*)')
    .eq('business_id', assistant.business_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Experiencia de Ventas</h1>
        <p className="text-gray-600">
          Revisa y aprueba patrones de objeciones de la industria para que{' '}
          {assistant.name} los use en sus conversaciones
        </p>
      </div>
      <SuggestionList
        initialSuggestions={suggestions ?? []}
        initialFilter="pending"
      />
    </div>
  )
}
