'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'

interface AssistantOption {
  id: string
  name: string | null
}

export function ConversationFilters({
  assistants,
}: {
  assistants: AssistantOption[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status') ?? ''
  const assistantId = searchParams.get('assistant_id') ?? ''

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--atmosphere-text-secondary)' }} />
        <input
          type="text"
          placeholder="Buscar por cliente..."
          defaultValue={search}
          onChange={(e) => setParam('search', e.target.value)}
          className="w-full rounded-xl border bg-transparent py-2 pl-9 pr-8 text-sm outline-none transition-all duration-200 focus:ring-2"
          style={{
            borderColor: 'var(--elevation-3, rgba(0,0,0,0.08))',
            color: 'var(--atmosphere-text)',
          }}
        />
        {search && (
          <button
            onClick={() => setParam('search', '')}
            className="absolute right-2 top-1/2 -translate-y-1/2"
          >
            <X className="h-4 w-4" style={{ color: 'var(--atmosphere-text-secondary)' }} />
          </button>
        )}
      </div>

      <select
        value={status}
        onChange={(e) => setParam('status', e.target.value)}
        className="rounded-xl border bg-transparent px-3 py-2 text-sm outline-none transition-all duration-200"
        style={{
          borderColor: 'var(--elevation-3, rgba(0,0,0,0.08))',
          color: 'var(--atmosphere-text)',
        }}
      >
        <option value="">Todas</option>
        <option value="active">Activas</option>
        <option value="waiting">En espera</option>
        <option value="completed">Completadas</option>
        <option value="abandoned">Abandonadas</option>
        <option value="archived">Archivadas</option>
      </select>

      <select
        value={assistantId}
        onChange={(e) => setParam('assistant_id', e.target.value)}
        className="rounded-xl border bg-transparent px-3 py-2 text-sm outline-none transition-all duration-200"
        style={{
          borderColor: 'var(--elevation-3, rgba(0,0,0,0.08))',
          color: 'var(--atmosphere-text)',
        }}
      >
        <option value="">Todos los asistentes</option>
        {assistants.map((a) => (
          <option key={a.id} value={a.id}>{a.name ?? 'MIA'}</option>
        ))}
      </select>
    </div>
  )
}
