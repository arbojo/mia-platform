'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

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
  parent: ParentMemory
}

interface SuggestionCardProps {
  suggestion: Suggestion
  onAction: (id: string, status: 'approved' | 'dismissed', customizedResponse?: string) => Promise<void>
}

export function SuggestionCard({ suggestion, onAction }: SuggestionCardProps) {
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [customResponse, setCustomResponse] = useState('')

  const parent = suggestion.parent
  const probability = (parent.conversion_probability * 100).toFixed(0)

  async function handleAction(status: 'approved' | 'dismissed') {
    setLoading(true)
    try {
      await onAction(suggestion.id, status, editing ? customResponse : undefined)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border border-gray-200 transition-shadow hover:shadow-md">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-500 mb-1">
              Objeción del cliente
            </p>
            <p className="text-gray-900 font-medium">
              &ldquo;{parent.customer_objection}&rdquo;
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {probability}% conversión
          </Badge>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-500 mb-1">
            Respuesta recomendada
          </p>
          <p className="text-gray-700 text-sm leading-relaxed">
            {parent.suggested_response}
          </p>
        </div>

        {editing && (
          <div>
            <label className="text-sm font-medium text-gray-500 mb-1 block">
              Personalizar respuesta
            </label>
            <textarea
              value={customResponse}
              onChange={(e) => setCustomResponse(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Adapta la respuesta al contexto de tu negocio..."
            />
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="default"
            disabled={loading}
            onClick={() => handleAction('approved')}
          >
            Aprobar
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => setEditing(!editing)}
          >
            {editing ? 'Cancelar' : 'Personalizar'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={loading}
            onClick={() => handleAction('dismissed')}
          >
            Descartar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
