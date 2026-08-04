'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface AnalysisReason {
  type: string
  label: string
  content: string
}

interface ResponseAnalysisProps {
  messageId: string
  assistantId: string
  conversationId?: string
}

export function ResponseAnalysis({ messageId, assistantId, conversationId }: ResponseAnalysisProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<{
    reasoning: AnalysisReason[]
    confidence: number
  } | null>(null)

  const handleAnalyze = async () => {
    if (analysis) {
      setIsOpen(!isOpen)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/laboratorio/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          conversationId
            ? { conversationId, assistantId }
            : { messageId, assistantId }
        ),
      })
      const data = await res.json()
      setAnalysis(data)
      setIsOpen(true)
    } catch (error) {
      console.error('Analysis error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-2">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 text-xs text-gray-500"
        onClick={handleAnalyze}
        disabled={loading}
      >
        {loading ? '...' : '🔍 ¿Por qué respondió esto?'}
      </Button>

      {isOpen && analysis && (
        <div className="mt-2 p-3 bg-olive-50 border border-olive-200 rounded-lg text-xs space-y-2">
          <p className="font-medium text-olive-800">Análisis de respuesta</p>

          {analysis.reasoning.length > 0 ? (
            <>
              <p className="text-gray-600">Respuesta basada en:</p>
              <ul className="space-y-2">
                {analysis.reasoning.map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <div>
                      <p className="font-medium text-gray-700">{r.label}</p>
                      <p className="text-gray-500 italic">&ldquo;{r.content}&rdquo;</p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-gray-500">
              No se pudo determinar el origen de esta respuesta.
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <span className="text-gray-600">Confianza:</span>
            <Badge variant="secondary">{analysis.confidence}%</Badge>
          </div>
        </div>
      )}
    </div>
  )
}
