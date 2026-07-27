'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ReadinessScore } from '@/components/studio/ReadinessScore'
import { AnalysisReport } from '@/components/studio/AnalysisReport'
import { SuggestionCard } from '@/components/studio/SuggestionCard'

interface Report {
  id: string
  status: string
  overall_score: number | null
  completeness_score: number | null
  consistency_score: number | null
  readiness_score: number | null
  gaps: Array<{ field: string; description: string; severity: string }>
  conflicts: Array<{ description: string; items: string[]; severity: string }>
  readiness_issues: Array<{ question: string; reason: string; severity: string }>
  created_at: string
  completed_at: string | null
}

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

interface KnowledgeStudioProps {
  businessId: string
  initialReport: Report | null
  initialSuggestions: Suggestion[]
}

export function KnowledgeStudio({ businessId, initialReport, initialSuggestions }: KnowledgeStudioProps) {
  const [report, setReport] = useState<Report | null>(initialReport)
  const [suggestions, setSuggestions] = useState<Suggestion[]>(initialSuggestions)
  const [analyzing, setAnalyzing] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')

  const handleAnalyze = async () => {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/knowledge/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: businessId }),
      })

      if (res.ok) {
        const data = await res.json()

        const reportRes = await fetch(`/api/knowledge/analyze/${data.report_id}`)
        if (reportRes.ok) {
          const { report: newReport, suggestions: newSuggestions } = await reportRes.json()
          setReport(newReport)
          setSuggestions(newSuggestions)
        }
      }
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSuggestionAction = async (suggestionId: string, status: 'approved' | 'rejected') => {
    const res = await fetch(`/api/knowledge/suggestions/${suggestionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })

    if (res.ok) {
      setSuggestions((prev) =>
        prev.map((s) => (s.id === suggestionId ? { ...s, status } : s))
      )
    }
  }

  const filteredSuggestions = suggestions.filter((s) =>
    filter === 'all' ? true : s.status === filter
  )

  const pendingCount = suggestions.filter((s) => s.status === 'pending').length
  const approvedCount = suggestions.filter((s) => s.status === 'approved').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Knowledge Studio</h1>
          <p className="text-gray-600">
            Evalúa qué tan preparado está tu asistente para vender
          </p>
        </div>
        <Button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="bg-violet-600 hover:bg-violet-700"
        >
          {analyzing ? 'Analizando...' : 'Ejecutar Análisis'}
        </Button>
      </div>

      {report && report.status === 'completed' && report.overall_score !== null ? (
        <>
          <ReadinessScore
            overall={report.overall_score}
            completeness={report.completeness_score ?? 0}
            consistency={report.consistency_score ?? 0}
            readiness={report.readiness_score ?? 0}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-amber-100">
              <CardContent className="pt-4">
                <p className="text-2xl font-bold text-amber-600">
                  {report.gaps.length + report.conflicts.length + report.readiness_issues.length}
                </p>
                <p className="text-sm text-muted-foreground">problemas detectados</p>
              </CardContent>
            </Card>
            <Card className="border-green-100">
              <CardContent className="pt-4">
                <p className="text-2xl font-bold text-green-600">{approvedCount}</p>
                <p className="text-sm text-muted-foreground">sugerencias aprobadas</p>
              </CardContent>
            </Card>
            <Card className="border-orange-100">
              <CardContent className="pt-4">
                <p className="text-2xl font-bold text-orange-600">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">sugerencias pendientes</p>
              </CardContent>
            </Card>
          </div>

          <AnalysisReport
            gaps={report.gaps}
            conflicts={report.conflicts}
            readinessIssues={report.readiness_issues}
          />

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Sugerencias ({suggestions.length})
              </h2>
              <div className="flex gap-2">
                {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
                  <Button
                    key={f}
                    variant={filter === f ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter(f)}
                  >
                    {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendientes' : f === 'approved' ? 'Aprobadas' : 'Rechazadas'}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {filteredSuggestions.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onAction={handleSuggestionAction}
                />
              ))}
              {filteredSuggestions.length === 0 && (
                <p className="text-center text-gray-500 py-8">
                  {filter === 'all'
                    ? 'Ejecuta un análisis para ver sugerencias.'
                    : `No hay sugerencias ${filter === 'pending' ? 'pendientes' : filter === 'approved' ? 'aprobadas' : 'rechazadas'}.`}
                </p>
              )}
            </div>
          </div>
        </>
      ) : report && report.status === 'analyzing' ? (
        <div className="text-center py-12">
          <div className="animate-pulse text-violet-600 text-lg">Analizando conocimiento...</div>
          <p className="text-gray-500 mt-2">Esto puede tomar unos segundos</p>
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed border-violet-200 rounded-xl">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Ejecuta tu primer análisis
          </h2>
          <p className="text-gray-600 mb-6">
            MIA evaluará tu conocimiento y te dirá qué tan preparado está tu asistente
          </p>
          <Button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="bg-violet-600 hover:bg-violet-700"
          >
            {analyzing ? 'Analizando...' : 'Ejecutar Análisis'}
          </Button>
        </div>
      )}
    </div>
  )
}
