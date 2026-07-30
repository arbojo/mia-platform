import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import { ConversationFilters } from '@/components/conversations/ConversationFilters'
import { ConversationList } from '@/components/conversations/ConversationList'

interface CustomerData {
  name: string | null
  phone: string | null
  email: string | null
}

interface AssistantData {
  name: string | null
  id: string
}

interface ConversationRow {
  id: string
  customer_id: string | null
  assistant_id: string
  type: string
  status: string
  notes?: string | null
  created_at: string
  customers: CustomerData | null
  assistants: AssistantData | null
}

interface MessageRow {
  conversation_id: string
  content: string
  created_at: string
  role: string
}

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; assistant_id?: string }>
}) {
  const params = await searchParams
  const { supabase, user } = await requireAuth()

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!business) {
    redirect('/dashboard/onboarding')
  }

  const { data: assistants } = await supabase
    .from('assistants')
    .select('id, name')
    .eq('business_id', business.id)

  const assistantIds = assistants?.map((a) => a.id) ?? []

  if (assistantIds.length === 0) {
    return (
      <div className="animate-appear-up flex flex-col items-center justify-center py-24">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{
            backgroundColor: 'var(--elevation-2)',
            color: 'var(--atmosphere-accent)',
          }}
        >
          <MessageSquare className="h-7 w-7" />
        </div>
        <h1
          className="mt-6 text-xl font-semibold"
          style={{ color: 'var(--atmosphere-text)' }}
        >
          Conversaciones
        </h1>
        <p
          className="mt-2 max-w-md text-center text-sm leading-relaxed"
          style={{ color: 'var(--atmosphere-text-secondary)' }}
        >
          No hay conversaciones todavía. Crea un asistente y conéctalo a un canal para empezar a recibir mensajes.
        </p>
        <Link
          href="/dashboard/assistants"
          className="mt-8 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200"
          style={{
            backgroundColor: 'var(--elevation-2)',
            color: 'var(--atmosphere-text)',
          }}
        >
          Ir a Asistentes →
        </Link>
      </div>
    )
  }

  let query = supabase
    .from('conversations')
    .select('*, customers(name, phone, email), assistants(name, id)')
    .in('assistant_id', assistantIds)
    .eq('type', 'live')

  if (params.status) {
    query = query.eq('status', params.status)
  }
  if (params.assistant_id) {
    query = query.eq('assistant_id', params.assistant_id)
  }

  query = query.order('created_at', { ascending: false })

  const { data: conversations } = await query

  const conversationList = (conversations ?? []) as unknown as ConversationRow[]

  let filteredList = conversationList
  if (params.search) {
    const searchLower = params.search.toLowerCase()
    filteredList = filteredList.filter((c) => {
      const label = c.customers?.name ?? c.customers?.phone ?? c.customers?.email ?? ''
      return label.toLowerCase().includes(searchLower)
    })
  }

  const lastMessagesMap = new Map<string, MessageRow>()
  if (filteredList.length > 0) {
    const { data: messages } = await supabase
      .from('messages')
      .select('conversation_id, content, created_at, role')
      .in('conversation_id', filteredList.map((c) => c.id))
      .order('created_at', { ascending: false })

    const seen = new Set<string>()
    for (const msg of messages ?? []) {
      if (!seen.has(msg.conversation_id)) {
        seen.add(msg.conversation_id)
        lastMessagesMap.set(msg.conversation_id, msg as MessageRow)
      }
    }
  }

  const activeCount = filteredList.filter((c) => c.status === 'active').length
  const waitingCount = filteredList.filter((c) => c.status === 'waiting').length
  const completedCount = filteredList.filter((c) => c.status === 'completed').length
  const abandonedCount = filteredList.filter((c) => c.status === 'abandoned').length
  const archivedCount = filteredList.filter((c) => c.status === 'archived').length

  return (
    <div className="animate-appear-up space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
          Conversaciones
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
          {filteredList.length} conversación{filteredList.length !== 1 ? 'es' : ''}
          {params.status === 'active' ? ' activas' : params.status === 'archived' ? ' archivadas' : ''}
        </p>
      </div>

      <ConversationFilters assistants={assistants as { id: string; name: string | null }[]} />

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
        <span>Total: <strong>{filteredList.length}</strong></span>
        <span>Activas: <strong className="text-emerald-600">{activeCount}</strong></span>
        {waitingCount > 0 && <span>Espera: <strong className="text-amber-600">{waitingCount}</strong></span>}
        {completedCount > 0 && <span>Completadas: <strong className="text-blue-600">{completedCount}</strong></span>}
        {abandonedCount > 0 && <span>Abandonadas: <strong className="text-red-600">{abandonedCount}</strong></span>}
        {archivedCount > 0 && <span>Archivadas: <strong className="text-gray-500">{archivedCount}</strong></span>}
      </div>

      <ConversationList
        conversations={filteredList}
        lastMessages={lastMessagesMap}
      />
    </div>
  )
}
