'use client'

import { useState, useCallback } from 'react'
import { SuggestionCard } from './SuggestionCard'

interface ParentMemory {
  pattern_key: string
  customer_objection: string
  suggested_response: string
  conversion_probability: number
  confidence_level: number
}

interface Suggestion {
  id: string
  parent_memory_id: string
  status: string
  customized_response: string | null
  created_at: string
  parent: ParentMemory
}

type FilterStatus = 'pending' | 'approved' | 'dismissed'

interface SuggestionListProps {
  initialSuggestions: Suggestion[]
  initialFilter: FilterStatus
}

export function SuggestionList({
  initialSuggestions,
  initialFilter,
}: SuggestionListProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>(initialSuggestions)
  const [filter, setFilter] = useState<FilterStatus>(initialFilter)
  const [loading, setLoading] = useState(false)

  const loadSuggestions = useCallback(async (status: FilterStatus) => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/admin/experience/suggestions?status=${status}`,
      )
      if (res.ok) {
        const data = await res.json()
        setSuggestions(data.suggestions ?? [])
      }
    } catch (err) {
      console.error('Failed to load suggestions:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  function handleFilterChange(status: FilterStatus) {
    setFilter(status)
    loadSuggestions(status)
  }

  async function handleAction(
    id: string,
    status: 'approved' | 'dismissed',
    customizedResponse?: string,
  ) {
    const res = await fetch(`/api/admin/experience/suggestions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, customizedResponse }),
    })

    if (res.ok) {
      setSuggestions((prev) => prev.filter((s) => s.id !== id))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {(['pending', 'approved', 'dismissed'] as const).map((status) => (
          <button
            key={status}
            onClick={() => handleFilterChange(status)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              filter === status
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {status === 'pending' && 'Pendientes'}
            {status === 'approved' && 'Aprobadas'}
            {status === 'dismissed' && 'Descartadas'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Cargando...</div>
      ) : suggestions.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {filter === 'pending'
            ? 'No hay sugerencias pendientes'
            : `No hay sugerencias ${filter === 'approved' ? 'aprobadas' : 'descartadas'}`}
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              onAction={handleAction}
            />
          ))}
        </div>
      )}
    </div>
  )
}
