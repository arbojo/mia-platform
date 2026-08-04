'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Suggestion {
  id: string
  type: string
  severity: string
  title: string
  description: string
  suggested_category: string | null
  suggested_question: string | null
  suggested_answer: string | null
  suggested_rule_content: string | null
  status: string
}

interface SuggestionCardProps {
  suggestion: Suggestion
  onAction: (id: string, status: 'approved' | 'rejected') => void
  onEdit?: (suggestion: Suggestion) => void
}

function getSeverityBadge(severity: string) {
  const styles: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-green-100 text-green-700',
  }
  return styles[severity] ?? 'bg-gray-100 text-gray-700'
}

function getTypeLabel(type: string) {
  const labels: Record<string, string> = {
    missing_knowledge: 'Conocimiento faltante',
    missing_product: 'Producto faltante',
    missing_rule: 'Regla faltante',
    contradiction: 'Contradicción',
    improvement: 'Mejora',
  }
  return labels[type] ?? type
}

export function SuggestionCard({ suggestion, onAction, onEdit }: SuggestionCardProps) {
  const [loading, setLoading] = useState(false)

  const handleAction = async (status: 'approved' | 'rejected') => {
    setLoading(true)
    await onAction(suggestion.id, status)
    setLoading(false)
  }

  return (
    <div className={`p-4 border rounded-xl ${suggestion.status === 'approved' ? 'bg-green-50 border-green-200' : suggestion.status === 'rejected' ? 'bg-gray-50 border-gray-200 opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Badge className={getSeverityBadge(suggestion.severity)}>{suggestion.severity}</Badge>
            <Badge variant="outline">{getTypeLabel(suggestion.type)}</Badge>
            {suggestion.status !== 'pending' && (
              <Badge variant={suggestion.status === 'approved' ? 'default' : 'secondary'}>
                {suggestion.status === 'approved' ? 'Aprobada' : 'Rechazada'}
              </Badge>
            )}
          </div>
          <h3 className="font-medium text-gray-900">{suggestion.title}</h3>
          <p className="text-sm text-gray-600 mt-1">{suggestion.description}</p>

          {suggestion.suggested_question && suggestion.suggested_answer && (
            <div className="mt-3 p-3 bg-olive-50 rounded-lg">
              <p className="text-xs font-medium text-olive-700 mb-1">Conocimiento sugerido:</p>
              <p className="text-sm"><span className="font-medium">P:</span> {suggestion.suggested_question}</p>
              <p className="text-sm"><span className="font-medium">R:</span> {suggestion.suggested_answer}</p>
              {suggestion.suggested_category && (
                <Badge variant="secondary" className="mt-2">{suggestion.suggested_category}</Badge>
              )}
            </div>
          )}

          {suggestion.suggested_rule_content && (
            <div className="mt-3 p-3 bg-amber-50 rounded-lg">
              <p className="text-xs font-medium text-amber-700 mb-1">Regla sugerida:</p>
              <p className="text-sm">{suggestion.suggested_rule_content}</p>
            </div>
          )}
        </div>

        {suggestion.status === 'pending' && (
          <div className="flex gap-2">
            {onEdit && (suggestion.suggested_question || suggestion.suggested_rule_content) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(suggestion)}
                disabled={loading}
              >
                Editar
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => handleAction('approved')}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              Aprobar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAction('rejected')}
              disabled={loading}
            >
              Rechazar
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
