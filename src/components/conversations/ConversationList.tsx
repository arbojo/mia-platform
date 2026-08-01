'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Bot, Clock, ChevronRight, Archive, RotateCcw, CheckCircle2, MessageSquare, XCircle, StickyNote } from 'lucide-react'
import { MemoryPanel } from '@/components/customers/MemoryPanel'
import { Button } from '@/components/ui/button'

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
  created_at: string
  notes?: string | null
  customers: CustomerData | null
  assistants: AssistantData | null
}

interface MessageRow {
  conversation_id: string
  content: string
  created_at: string
  role: string
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active: { label: 'Activa', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
  waiting: { label: 'Espera', className: 'bg-amber-500/10 text-amber-600 border-amber-200' },
  completed: { label: 'Completada', className: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  abandoned: { label: 'Abandonada', className: 'bg-red-500/10 text-red-600 border-red-200' },
  archived: { label: 'Archivada', className: 'bg-gray-500/10 text-gray-500 border-gray-200' },
}

function getCustomerLabel(customer: CustomerData | null): string {
  if (!customer) return '—'
  return customer.name || customer.phone || customer.email || '—'
}

function getLastMessageTime(msgCreatedAt: string | undefined, convCreatedAt: string): string {
  const date = new Date(msgCreatedAt ?? convCreatedAt)
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

function getLastMessagePreview(lastMessages: Map<string, MessageRow>, conversationId: string): string {
  const msg = lastMessages.get(conversationId)
  if (!msg) return 'Sin mensajes'
  return msg.content.length > 100 ? msg.content.slice(0, 100) + '...' : msg.content
}

export function ConversationList({
  conversations,
  lastMessages,
}: {
  conversations: ConversationRow[]
  lastMessages: Map<string, MessageRow>
}) {
  const router = useRouter()
  const [toggling, setToggling] = useState<Set<string>>(new Set())

  async function changeStatus(convId: string, newStatus: string) {
    setToggling((prev) => new Set(prev).add(convId))
    try {
      const res = await fetch(`/api/conversations/${convId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed to update')
      router.refresh()
    } catch (error) {
      console.error('Failed to update conversation status:', error)
    } finally {
      setToggling((prev) => {
        const next = new Set(prev)
        next.delete(convId)
        return next
      })
    }
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{
            backgroundColor: 'var(--elevation-2)',
            color: 'var(--atmosphere-accent)',
          }}
        >
          <Bot className="h-7 w-7" />
        </div>
        <p className="mt-6 text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
          No se encontraron conversaciones con esos filtros.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {conversations.map((conv) => {
        const statusBadge = STATUS_CONFIG[conv.status] ?? STATUS_CONFIG.archived
        return (
          <ConversationCard
            key={conv.id}
            conv={conv}
            statusBadge={statusBadge}
            lastMessagePreview={getLastMessagePreview(lastMessages, conv.id)}
            lastMessageTime={getLastMessageTime(lastMessages.get(conv.id)?.created_at, conv.created_at)}
            isToggling={toggling.has(conv.id)}
            onChangeStatus={(s) => changeStatus(conv.id, s)}
          />
        )
      })}
    </div>
  )
}

function ConversationCard({
  conv,
  statusBadge,
  lastMessagePreview,
  lastMessageTime,
  isToggling,
  onChangeStatus,
}: {
  conv: ConversationRow
  statusBadge: { label: string; className: string }
  lastMessagePreview: string
  lastMessageTime: string
  isToggling: boolean
  onChangeStatus: (status: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [showingActions, setShowingActions] = useState(false)
  const [notes, setNotes] = useState(conv.notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)
  const router = useRouter()

  async function saveNotes() {
    setSavingNotes(true)
    try {
      await fetch(`/api/conversations/${conv.id}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      router.refresh()
    } finally {
      setSavingNotes(false)
    }
  }

  return (
    <div
      className="rounded-xl transition-all duration-200"
      style={{ backgroundColor: 'var(--elevation-2)' }}
    >
      <div className="flex items-center gap-4 p-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex shrink-0 items-center justify-center transition-transform duration-200"
          style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
        >
          <ChevronRight
            className="h-4 w-4"
            style={{ color: 'var(--atmosphere-text-secondary)' }}
          />
        </button>

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
            {conv.notes && (
              <StickyNote className="h-3 w-3" style={{ color: 'var(--atmosphere-text-secondary)' }} />
            )}
          </div>

          <div className="mt-0.5 flex items-center gap-2 text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
            <Bot className="h-3 w-3 shrink-0" />
            <span className="truncate">{conv.assistants?.name ?? '—'}</span>
            <span className="opacity-40">·</span>
            <Clock className="h-3 w-3 shrink-0" />
            <span className="shrink-0">{lastMessageTime}</span>
          </div>

          <p
            className="mt-1 truncate text-xs leading-relaxed"
            style={{ color: 'var(--atmosphere-text-secondary)' }}
          >
            {lastMessagePreview}
          </p>
        </div>

        <button
          onClick={() => setShowingActions(!showingActions)}
          className="shrink-0 rounded-lg p-2 text-xs font-medium transition-all duration-200 hover:opacity-70"
          style={{ color: 'var(--atmosphere-text-secondary)' }}
        >
          <MessageSquare className="h-4 w-4" />
        </button>
      </div>

      {showingActions && (
        <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: 'var(--elevation-3, rgba(0,0,0,0.05))' }}>
          <div className="flex flex-wrap gap-2">
            {conv.status !== 'completed' && (
              <Button size="sm" variant="outline" onClick={() => onChangeStatus('completed')} disabled={isToggling}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                Marcar completada
              </Button>
            )}
            {conv.status !== 'waiting' && (
              <Button size="sm" variant="outline" onClick={() => onChangeStatus('waiting')} disabled={isToggling}>
                <Clock className="h-3.5 w-3.5 mr-1.5" />
                Poner en espera
              </Button>
            )}
            {conv.status !== 'abandoned' && (
              <Button size="sm" variant="outline" onClick={() => onChangeStatus('abandoned')} disabled={isToggling}>
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                Abandonada
              </Button>
            )}
            {conv.status !== 'archived' && (
              <Button size="sm" variant="outline" onClick={() => onChangeStatus('archived')} disabled={isToggling}>
                <Archive className="h-3.5 w-3.5 mr-1.5" />
                Archivar
              </Button>
            )}
            {conv.status === 'archived' && (
              <Button size="sm" variant="outline" onClick={() => onChangeStatus('active')} disabled={isToggling}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Reactivar
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Añadir nota..."
              className="flex-1 rounded-lg border bg-transparent px-3 py-1.5 text-xs outline-none"
              style={{ borderColor: 'var(--elevation-3, rgba(0,0,0,0.08))', color: 'var(--atmosphere-text)' }}
            />
            <Button size="sm" variant="outline" onClick={saveNotes} disabled={savingNotes}>
              <StickyNote className="h-3.5 w-3.5 mr-1.5" />
              Guardar
            </Button>
          </div>
        </div>
      )}

      {expanded && conv.customer_id && (
        <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: 'var(--elevation-3, rgba(0,0,0,0.05))' }}>
          <MemoryPanel customerId={conv.customer_id} assistantId={conv.assistant_id} />
        </div>
      )}
    </div>
  )
}
