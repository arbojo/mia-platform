import { requireAuth } from '@/lib/auth'
import { getConversations } from '@/lib/dashboard/conversations'
import type { ConversationRow } from '@/lib/dashboard/conversations'
import Link from 'next/link'
import { HeartHandshake, Search, X } from 'lucide-react'

const typeLabels: Record<string, string> = {
  live: 'En vivo',
  training: 'Entrenamiento',
  simulation: 'Simulación',
}

const typeColors: Record<string, string> = {
  live: 'var(--mia-green)',
  training: 'var(--mia-blue)',
  simulation: 'var(--mia-violet)',
}

const statusLabels: Record<string, string> = {
  active: 'Activa',
  archived: 'Archivada',
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const colors: Record<string, { bg: string; fg: string; label: string }> = {
    answered: { bg: 'var(--mia-green)', fg: 'white', label: 'Respondida' },
    pending: { bg: 'rgba(255,255,255,0.06)', fg: 'var(--atmosphere-text-secondary)', label: 'Pendiente' },
    archived: { bg: 'var(--mia-platinum)', fg: 'white', label: 'Archivada' },
  }
  const c = colors[outcome] ?? { bg: 'var(--elevation-2)', fg: 'var(--atmosphere-text)', label: outcome }

  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style={{ backgroundColor: `${c.bg}20`, color: c.fg === 'white' ? c.bg : c.fg }}
    >
      {c.label}
    </span>
  )
}

function formatTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHrs = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHrs / 24)

  if (diffMin < 1) return 'Ahora'
  if (diffMin < 60) return `Hace ${diffMin} min`
  if (diffHrs < 24) return `Hace ${diffHrs}h`
  if (diffDays === 1) return 'Ayer'
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

function ConversationCard({ conv }: { conv: ConversationRow }) {
  const typeColor = typeColors[conv.type] ?? 'var(--atmosphere-text-secondary)'

  return (
    <Link href={`/dashboard/conversations/${conv.id}`} className="block">
      <div
        className="flex items-start gap-4 rounded-xl border p-4 transition-all duration-200"
        style={{
          backgroundColor: 'var(--elevation-1)',
          borderColor: 'var(--atmosphere-border)',
        }}
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
          style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
            color: 'var(--atmosphere-text)',
          }}
        >
          {(conv.customerName ?? '?').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-semibold"
              style={{ color: 'var(--atmosphere-text)' }}
            >
              {conv.customerName ?? 'Cliente'}
            </span>
            <span
              className="text-xs"
              style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.5 }}
            >
              {formatTime(conv.lastActivity)}
            </span>
          </div>
          {conv.lastMessage && (
            <p
              className="mt-1 truncate text-sm leading-relaxed"
              style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.7 }}
            >
              {conv.lastMessage}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <span
              className="rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
              style={{ backgroundColor: `${typeColor}15`, color: typeColor }}
            >
              {typeLabels[conv.type] ?? conv.type}
            </span>
            <OutcomeBadge outcome={conv.status} />
            {conv.messageCount > 0 && (
              <span
                className="text-[10px]"
                style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.5 }}
              >
                {conv.messageCount} msg
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

function FilterBar({
  currentStatus,
  currentType,
  currentSearch,
}: {
  currentStatus?: string
  currentType?: string
  currentSearch?: string
}) {
  const filters = [
    { key: 'status', value: currentStatus },
    { key: 'type', value: currentType },
    { key: 'search', value: currentSearch },
  ]
  const hasFilters = filters.some((f) => f.value)

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <form method="GET" className="relative flex-1 max-w-md">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.5 }}
        />
        <input
          name="q"
          defaultValue={currentSearch ?? ''}
          placeholder="Buscar por nombre del cliente..."
          className="w-full rounded-xl border py-2 pl-10 pr-4 text-sm outline-none transition-all duration-200"
          style={{
            backgroundColor: 'var(--elevation-1)',
            borderColor: 'var(--atmosphere-border)',
            color: 'var(--atmosphere-text)',
          }}
        />
      </form>
      <div className="flex flex-wrap items-center gap-2">
        {['active', 'archived'].map((s) => {
          const isActive = currentStatus === s
          return (
            <a
              key={s}
              href={
                isActive
                  ? `?${new URLSearchParams({ ...(currentType ? { type: currentType } : {}), ...(currentSearch ? { q: currentSearch } : {}) }).toString()}`
                  : `?${new URLSearchParams({ status: s, ...(currentType ? { type: currentType } : {}), ...(currentSearch ? { q: currentSearch } : {}) }).toString()}`
              }
              className="rounded-full px-3 py-1 text-xs font-medium transition-all duration-200"
              style={{
                backgroundColor: isActive ? 'var(--atmosphere-accent)' : 'var(--elevation-2)',
                color: isActive ? 'white' : 'var(--atmosphere-text-secondary)',
              }}
            >
              {statusLabels[s] ?? s}
            </a>
          )
        })}
        {['live', 'training', 'simulation'].map((t) => {
          const isActive = currentType === t
          return (
            <a
              key={t}
              href={
                isActive
                  ? `?${new URLSearchParams({ ...(currentStatus ? { status: currentStatus } : {}), ...(currentSearch ? { q: currentSearch } : {}) }).toString()}`
                  : `?${new URLSearchParams({ type: t, ...(currentStatus ? { status: currentStatus } : {}), ...(currentSearch ? { q: currentSearch } : {}) }).toString()}`
              }
              className="rounded-full px-3 py-1 text-xs font-medium transition-all duration-200"
              style={{
                backgroundColor: isActive ? 'var(--mia-gold)' : 'var(--elevation-2)',
                color: isActive ? 'white' : 'var(--atmosphere-text-secondary)',
              }}
            >
              {typeLabels[t] ?? t}
            </a>
          )
        })}
        {hasFilters && (
          <Link
            href="/dashboard/conversations"
            className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all duration-200"
            style={{
              backgroundColor: 'var(--elevation-2)',
              color: 'var(--atmosphere-text-secondary)',
            }}
          >
            <X className="h-3 w-3" />
            Limpiar
          </Link>
        )}
      </div>
    </div>
  )
}

function Pagination({
  currentPage,
  totalPages,
  baseParams,
}: {
  currentPage: number
  totalPages: number
  baseParams: URLSearchParams
}) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-2">
      {currentPage > 1 && (
        <a
          href={`?${new URLSearchParams({ ...Object.fromEntries(baseParams), page: String(currentPage - 1) }).toString()}`}
          className="rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200"
          style={{
            backgroundColor: 'var(--elevation-2)',
            color: 'var(--atmosphere-text)',
          }}
        >
          ← Anterior
        </a>
      )}
      <span
        className="px-3 py-1.5 text-sm"
        style={{ color: 'var(--atmosphere-text-secondary)' }}
      >
        {currentPage} / {totalPages}
      </span>
      {currentPage < totalPages && (
        <a
          href={`?${new URLSearchParams({ ...Object.fromEntries(baseParams), page: String(currentPage + 1) }).toString()}`}
          className="rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200"
          style={{
            backgroundColor: 'var(--elevation-2)',
            color: 'var(--atmosphere-text)',
          }}
        >
          Siguiente →
        </a>
      )}
    </div>
  )
}

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const awaited = await searchParams
  const q = typeof awaited.q === 'string' ? awaited.q : undefined
  const status = awaited.status === 'active' || awaited.status === 'archived' ? awaited.status : undefined
  const type = awaited.type === 'live' || awaited.type === 'training' || awaited.type === 'simulation' ? awaited.type : undefined
  const page = typeof awaited.page === 'string' ? Math.max(1, parseInt(awaited.page)) : 1

  const { supabase } = await requireAuth()

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .limit(1)
    .single()

  if (!business) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p style={{ color: 'var(--atmosphere-text-secondary)' }}>
          No se encontró información del negocio.
        </p>
      </div>
    )
  }

  const { data: conversations, total } = await getConversations(supabase, business.id, {
    search: q,
    status,
    type,
    page,
    pageSize: 20,
  })

  const totalPages = Math.max(1, Math.ceil(total / 20))
  const baseParams = new URLSearchParams()
  if (q) baseParams.set('q', q)
  if (status) baseParams.set('status', status)
  if (type) baseParams.set('type', type)

  return (
    <div className="animate-appear-up space-y-6">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{
            backgroundColor: 'var(--elevation-2)',
            color: 'var(--atmosphere-accent)',
          }}
        >
          <HeartHandshake className="h-5 w-5" />
        </div>
        <div>
          <h1
            className="text-lg font-semibold"
            style={{ color: 'var(--atmosphere-text)' }}
          >
            Conversaciones
          </h1>
          <p
            className="text-sm"
            style={{ color: 'var(--atmosphere-text-secondary)' }}
          >
            {total} {total === 1 ? 'conversación' : 'conversaciones'} encontradas
          </p>
        </div>
      </div>

      <FilterBar currentStatus={status} currentType={type} currentSearch={q} />

      {conversations.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center"
          style={{ backgroundColor: 'var(--elevation-1)' }}
        >
          <p className="text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
            {q || status || type
              ? 'No hay conversaciones que coincidan con los filtros.'
              : 'Aún no hay conversaciones. Cuando MIA comience a atender clientes, aparecerán aquí.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {conversations.map((conv) => (
            <ConversationCard key={conv.id} conv={conv} />
          ))}
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} baseParams={baseParams} />
    </div>
  )
}
