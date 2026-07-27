'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface CoachingFeedbackProps {
  feedback: string[]
  score: number | null
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-amber-600'
  return 'text-red-600'
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excelente'
  if (score >= 80) return 'Muy bien'
  if (score >= 70) return 'Bien'
  if (score >= 60) return 'Aceptable'
  if (score >= 40) return 'Mejorable'
  return 'Necesita práctica'
}

export function CoachingFeedback({ feedback, score }: CoachingFeedbackProps) {
  if (feedback.length === 0 && score === null) return null

  return (
    <Card className="border-amber-100">
      <CardContent className="pt-4">
        {score !== null && (
          <div className="text-center mb-4">
            <p className={`text-3xl font-bold ${getScoreColor(score)}`}>{score}</p>
            <p className="text-xs text-gray-500">{getScoreLabel(score)}</p>
          </div>
        )}

        {feedback.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Sugerencias</h4>
            <div className="space-y-2">
              {feedback.map((tip, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Badge variant="outline" className="mt-0.5 shrink-0">
                    {i + 1}
                  </Badge>
                  <p className="text-sm text-gray-700">{tip}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
