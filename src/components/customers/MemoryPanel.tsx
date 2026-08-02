'use client'

import { useState, useEffect } from 'react'
import { Brain, Loader2, AlertCircle } from 'lucide-react'

interface CustomerMemory {
  interests: string[]
  objections: string[]
  questions: string[]
  preferences: string[]
  lastInteraction: string | null
  summary: string
}

interface MemoryPanelProps {
  customerId: string
  assistantId: string
}

export function MemoryPanel({ customerId, assistantId }: MemoryPanelProps) {
  const [memory, setMemory] = useState<CustomerMemory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/customers/memory?customerId=${customerId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.memory) {
          setMemory(data.memory)
        }
        setLoading(false)
      })
      .catch(() => {
        setError('No se pudo cargar la memoria')
        setLoading(false)
      })
  }, [customerId])

  const handleExtract = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/customers/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, assistantId }),
      })
      const data = await res.json()
      if (data.memory) {
        setMemory(data.memory)
      }
    } catch {
      setError('Error al extraer memoria')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando memoria...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-500 py-2">
        <AlertCircle className="h-4 w-4" />
        {error}
      </div>
    )
  }

  if (!memory || (!memory.summary && memory.interests.length === 0)) {
    return (
      <div className="py-2">
        <button
          onClick={handleExtract}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-100"
        >
          <Brain className="h-3.5 w-3.5" />
          Extraer memoria del cliente
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-violet-700">
          <Brain className="h-3.5 w-3.5" />
          Memoria del Cliente
        </span>
        <button
          onClick={handleExtract}
          className="text-[10px] font-medium text-violet-500 hover:text-violet-700"
        >
          Actualizar
        </button>
      </div>

      {memory.summary && (
        <p className="mb-2 text-xs leading-relaxed text-gray-700">{memory.summary}</p>
      )}

      <div className="space-y-1">
        {memory.interests.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-[10px] font-medium text-gray-500">Intereses:</span>
            {memory.interests.map((i) => (
              <span key={i} className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">
                {i}
              </span>
            ))}
          </div>
        )}

        {memory.objections.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-[10px] font-medium text-gray-500">Objeciones:</span>
            {memory.objections.map((o) => (
              <span key={o} className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">
                {o}
              </span>
            ))}
          </div>
        )}

        {memory.preferences.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-[10px] font-medium text-gray-500">Preferencias:</span>
            {memory.preferences.map((p) => (
              <span key={p} className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] text-blue-700">
                {p}
              </span>
            ))}
          </div>
        )}
      </div>

      {memory.lastInteraction && (
        <p className="mt-2 text-[10px] text-gray-400">
          Última interacción: {new Date(memory.lastInteraction).toLocaleDateString('es-MX')}
        </p>
      )}
    </div>
  )
}
