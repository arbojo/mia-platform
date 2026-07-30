import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MessageSquare, User, Bot, Clock, ArrowRight } from 'lucide-react'

interface CustomerData {
  name: string | null
  phone: string | null
  email: string | null
}

interface AssistantData {
  name: string | null
}

interface ConversationRow {
  id: string
  customer_id: string | null
  assistant_id: string
  type: string
  status: string
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

function getCustomerLabel(customer: CustomerData | null): string {
  if (!customer) return '—'
  return customer.name || customer.phone || customer.email || '—'
}

function getStatusBadge(status: string): { label: string; className: string } {
  if (status === 'active') {
    return { label: 'Activa', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' }
  }
  return { label: 'Archivada', className: 'bg-gray-500/10 text-gray-500 border-gray-200' }
}

function getLastMessagePreview(lastMessages: MessageRow[], conversationId: string): string {
  const msg = lastMessages.find((m) => m.conversation_id === conversationId)
  if (!msg) return 'Sin mensajes'
  const preview = msg.content.length > 100 ? msg.content.slice(0, 100) + '...' : msg.content
  return preview
}

function getLastMessageTime(lastMessages: MessageRow[], conversationId: string, createdAt: string): string {
  const msg = lastMessages.find((m) => m.conversation_id === conversationId)
  const date = new Date(msg?.created_at ?? createdAt)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Ahora'
  if (diffMins < 60) return `Hace ${diffMins}m`
  if (diffHours < 24) return `Hace ${diffHours}h`
  if (diffDays < 7) return `Hace ${diffDays}d`
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

export default async function ConversationsPage() {
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
    .select('id')
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

  const { data: conversations } = await supabase
    .from('conversations')
    .select('*, customers(name, phone, email), assistants(name)')
    .in('assistant_id', assistantIds)
    .eq('type', 'live')
    .order('created_at', { ascending: false })

  const conversationList = (conversations ?? []) as unknown as ConversationRow[]

  const lastMessages: MessageRow[] = []
  if (conversationList.length > 0) {
    const { data: messages } = await supabase
      .from('messages')
      .select('conversation_id, content, created_at, role')
      .in('conversation_id', conversationList.map((c) => c.id))
      .order('created_at', { ascending: false })

    const seen = new Set<string>()
    for (const msg of messages ?? []) {
      if (!seen.has(msg.conversation_id)) {
        seen.add(msg.conversation_id)
        lastMessages.push(msg as MessageRow)
      }
    }
  }

  return (
    <div className="animate-appear-up space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
          Conversaciones
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
          {conversationList.length} conversación{conversationList.length !== 1 ? 'es' : ''} con clientes
        </p>
      </div>

      {conversationList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              backgroundColor: 'var(--elevation-2)',
              color: 'var(--atmosphere-accent)',
            }}
          >
            <MessageSquare className="h-7 w-7" />
          </div>
          <p
            className="mt-6 text-sm"
            style={{ color: 'var(--atmosphere-text-secondary)' }}
          >
            No hay conversaciones con clientes todavía.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {conversationList.map((conv) => {
            const statusBadge = getStatusBadge(conv.status)
            return (
              <div
                key={conv.id}
                className="group flex items-center gap-4 rounded-xl p-4 transition-all duration-200 hover:opacity-80"
                style={{
                  backgroundColor: 'var(--elevation-2)',
                }}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: 'var(--atmosphere-accent)',
                    color: '#fff',
                  }}
                >
                  <User className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="truncate text-sm font-medium"
                      style={{ color: 'var(--atmosphere-text)' }}
                    >
                      {getCustomerLabel(conv.customers)}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${statusBadge.className}`}
                    >
                      {statusBadge.label}
                    </span>
                  </div>

                  <div className="mt-0.5 flex items-center gap-2 text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                    <Bot className="h-3 w-3 shrink-0" />
                    <span className="truncate">{conv.assistants?.name ?? '—'}</span>
                    <span className="opacity-40">·</span>
                    <Clock className="h-3 w-3 shrink-0" />
                    <span className="shrink-0">{getLastMessageTime(lastMessages, conv.id, conv.created_at)}</span>
                  </div>

                  <p
                    className="mt-1 truncate text-xs leading-relaxed"
                    style={{ color: 'var(--atmosphere-text-secondary)' }}
                  >
                    {getLastMessagePreview(lastMessages, conv.id)}
                  </p>
                </div>

                <ArrowRight
                  className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-40"
                  style={{ color: 'var(--atmosphere-text-secondary)' }}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
