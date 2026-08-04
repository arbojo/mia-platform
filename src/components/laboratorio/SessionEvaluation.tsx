'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

interface Evaluation {
  score: number
  criteria: {
    product_knowledge: number
    empathy: number
    objection_handling: number
    closing: number
    rule_following: number
  }
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
}

interface SessionEvaluationProps {
  conversationId: string
  assistantId: string
  sessionId: string
  onTeach: (suggestions: string[]) => void
}

export function SessionEvaluation({
  conversationId,
  assistantId,
  sessionId,
  onTeach,
}: SessionEvaluationProps) {
  const [loading, setLoading] = useState(false)
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)

  const handleEvaluate = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/laboratorio/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, conversationId, assistantId }),
      })
      const data = await res.json()
      setEvaluation(data.evaluation)
    } catch (error) {
      console.error('Evaluation error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!evaluation) {
    return (
      <Button
        variant="outline"
        onClick={handleEvaluate}
        disabled={loading}
        className="w-full"
      >
        {loading ? 'Evaluando...' : '📊 Evaluar sesión'}
      </Button>
    )
  }

  const criteriaLabels: Record<string, string> = {
    product_knowledge: 'Conocimiento',
    empathy: 'Empatía',
    objection_handling: 'Manejo objec.',
    closing: 'Cierre',
    rule_following: 'Reglas',
  }

  return (
    <div className="p-4 border rounded-xl bg-gray-50 space-y-4">
      <div className="text-center">
        <p className="text-3xl font-bold text-olive-600">{evaluation.score}/10</p>
        <p className="text-sm text-gray-500">Evaluación general</p>
      </div>

      <div className="space-y-2">
        {Object.entries(evaluation.criteria).map(([key, value]) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs text-gray-600 w-24">
              {criteriaLabels[key] ?? key}
            </span>
            <Progress value={value * 10} className="flex-1 h-2" />
            <span className="text-xs font-medium text-gray-700 w-6 text-right">
              {value}
            </span>
          </div>
        ))}
      </div>

      {evaluation.strengths.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-700 mb-1">Fortalezas</p>
          <ul className="space-y-1">
            {evaluation.strengths.map((s, i) => (
              <li key={i} className="text-xs text-green-700 flex items-start gap-1">
                <span>✓</span> {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {evaluation.weaknesses.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-700 mb-1">Mejorar</p>
          <ul className="space-y-1">
            {evaluation.weaknesses.map((w, i) => (
              <li key={i} className="text-xs text-red-600 flex items-start gap-1">
                <span>✗</span> {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {evaluation.suggestions.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-700 mb-1">Sugerencias</p>
          <ul className="space-y-1">
            {evaluation.suggestions.map((s, i) => (
              <li key={i} className="text-xs text-olive-600 flex items-start gap-1">
                <span>→</span> {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button
        onClick={() => onTeach(evaluation.suggestions)}
        className="w-full bg-olive-600 hover:bg-olive-700"
      >
        ✨ Enseñarle esto a {assistantId ? 'MIA' : 'la asistente'}
      </Button>
    </div>
  )
}
