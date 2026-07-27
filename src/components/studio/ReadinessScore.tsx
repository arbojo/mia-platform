'use client'

import { Card, CardContent } from '@/components/ui/card'

interface ReadinessScoreProps {
  overall: number
  completeness: number
  consistency: number
  readiness: number
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-amber-600'
  return 'text-red-600'
}

function getBarColor(score: number): string {
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-amber-500'
  return 'bg-red-500'
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excelente'
  if (score >= 80) return 'Muy bien'
  if (score >= 70) return 'Bien'
  if (score >= 60) return 'Aceptable'
  if (score >= 40) return 'Necesita mejoras'
  return 'Crítico'
}

export function ReadinessScore({ overall, completeness, consistency, readiness }: ReadinessScoreProps) {
  return (
    <Card className="border-violet-100">
      <CardContent className="pt-6">
        <div className="text-center mb-6">
          <p className="text-sm text-muted-foreground mb-1">Puntuación de Preparación</p>
          <p className={`text-5xl font-bold ${getScoreColor(overall)}`}>{overall}</p>
          <p className="text-sm text-muted-foreground mt-1">{getScoreLabel(overall)}</p>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-3 mb-6">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${getBarColor(overall)}`}
            style={{ width: `${overall}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{completeness}</p>
            <p className="text-xs text-muted-foreground">Completitud</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{consistency}</p>
            <p className="text-xs text-muted-foreground">Consistencia</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{readiness}</p>
            <p className="text-xs text-muted-foreground">Preparación</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
