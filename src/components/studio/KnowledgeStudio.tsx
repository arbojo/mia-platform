'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ReadinessScore } from '@/components/studio/ReadinessScore'
import { AnalysisReport } from '@/components/studio/AnalysisReport'
import { SuggestionCard } from '@/components/studio/SuggestionCard'
import { KnowledgeItemDialog } from '@/components/knowledge/KnowledgeItemDialog'
import type { KnowledgeItemFormValues } from '@/components/knowledge/KnowledgeItemDialog'

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
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [editingSuggestion, setEditingSuggestion] = useState<Suggestion | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const handleAnalyze = async () => {
    setAnalyzing(true)
    setAnalyzeError(null)
    try {
      const res = await fetch('/api/knowledge/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: businessId }),
      })

      if (!res.ok) {
        let message = 'No se pudo ejecutar el análisis.'
        try {
          const { error } = await res.json()
          if (error) message = error
        } catch {
          // body vacío o no JSON
        }
        setAnalyzeError(message)
        return
      }

      const data = await res.json()

      const reportRes = await fetch(`/api/knowledge/analyze/${data.report_id}`)
      if (reportRes.ok) {
        const { report: newReport, suggestions: newSuggestions } = await reportRes.json()
        setReport(newReport)
        setSuggestions(newSuggestions)
      }
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Error inesperado al analizar.')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSuggestionAction = async (suggestionId: string, status: 'approved' | 'rejected') => {
    setActionError(null)
    try {
      const res = await fetch(`/api/knowledge/suggestions/${suggestionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (res.ok) {
        setSuggestions((prev) =>
          prev.map((s) => (s.id === suggestionId ? { ...s, status } : s))
        )
        return
      }

      let message = 'No se pudo guardar la sugerencia.'
      try {
        const { error } = await res.json()
        if (error) message = error
      } catch {
        // body vacío o no JSON
      }
      setActionError(message)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error inesperado al guardar la sugerencia.')
    }
  }

  const handleSuggestionEdit = async (values: KnowledgeItemFormValues) => {
    if (!editingSuggestion) return
    setSubmitting(true)
    setActionError(null)

    const edits: Record<string, unknown> = { category: values.category }
    if (editingSuggestion.suggested_rule_content) {
      edits.rule_content = values.ruleContent
    } else {
      edits.question = values.question
      edits.answer = values.answer
    }

    try {
      const res = await fetch(`/api/knowledge/suggestions/${editingSuggestion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved', edits }),
      })

      if (res.ok) {
        setSuggestions((prev) =>
          prev.map((s) => (s.id === editingSuggestion.id ? { ...s, status: 'approved' } : s))
        )
        setEditingSuggestion(null)
        return
      }

      let message = 'No se pudo guardar la sugerencia.'
      try {
        const { error } = await res.json()
        if (error) message = error
      } catch {
        // body vacío o no JSON
      }
      setActionError(message)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error inesperado al guardar la sugerencia.')
    } finally {
      setSubmitting(false)
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
          data-tour="studio-analyze"
          onClick={handleAnalyze}
          disabled={analyzing}
          className="bg-brand-600 hover:bg-brand-700"
        >
          {analyzing ? 'Analizando...' : 'Ejecutar Análisis'}
        </Button>
      </div>

      {analyzeError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {analyzeError}
        </div>
      )}

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {report && report.status === 'completed' && report.overall_score !== null ? (
        <>
          <div data-tour="studio-score">
            <ReadinessScore
              overall={report.overall_score}
              completeness={report.completeness_score ?? 0}
              consistency={report.consistency_score ?? 0}
              readiness={report.readiness_score ?? 0}
            />
          </div>

          <div data-tour="studio-stats" className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          <div data-tour="studio-suggestions">
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
                  onEdit={setEditingSuggestion}
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
      ) : report && report.status === 'failed' ? (
        <div className="text-center py-12 border-2 border-dashed border-red-200 rounded-xl">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            El análisis anterior falló
          </h2>
          <p className="text-gray-600 mb-6">
            No se pudo completar el análisis de conocimiento. Puedes intentarlo de nuevo.
          </p>
          <Button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="bg-brand-600 hover:bg-brand-700"
          >
            {analyzing ? 'Analizando...' : 'Reintentar Análisis'}
          </Button>
        </div>
      ) : report && report.status === 'analyzing' ? (
        <div className="text-center py-12">
          <div className="animate-pulse text-brand-600 text-lg">Analizando conocimiento...</div>
          <p className="text-gray-500 mt-2">Esto puede tomar unos segundos</p>
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed border-brand-200 rounded-xl">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Ejecuta tu primer análisis
          </h2>
          <p className="text-gray-600 mb-6">
            MIA evaluará tu conocimiento y te dirá qué tan preparado está tu asistente
          </p>
          <Button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="bg-brand-600 hover:bg-brand-700"
          >
            {analyzing ? 'Analizando...' : 'Ejecutar Análisis'}
          </Button>
        </div>
      )}

      <KnowledgeItemDialog
        key={editingSuggestion?.id ?? 'none'}
        open={!!editingSuggestion}
        onOpenChange={(o) => { if (!o) setEditingSuggestion(null) }}
        kind={editingSuggestion?.suggested_rule_content ? 'rule' : 'knowledge'}
        initial={editingSuggestion ? {
          category: editingSuggestion.suggested_category ?? (editingSuggestion.suggested_rule_content ? 'restrictions' : 'faq'),
          question: editingSuggestion.suggested_question ?? '',
          answer: editingSuggestion.suggested_answer ?? '',
          ruleContent: editingSuggestion.suggested_rule_content ?? '',
        } : undefined}
        title="Editar sugerencia"
        submitLabel="Guardar y Aprobar"
        submitting={submitting}
        onSubmit={handleSuggestionEdit}
      />
    </div>
  )
}
