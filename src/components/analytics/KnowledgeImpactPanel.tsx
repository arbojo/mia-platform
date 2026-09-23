'use client'

import { useEffect, useState } from 'react'
import { adminFetch } from '@/components/analytics/admin-api'

type KnowledgeImpactRow = {
  knowledge_item_id: string
  question: string
  category: string | null
  conversations_used: number
  conversations_sold: number
  close_rate: number
}

type KnowledgeImpactResponse = {
  impact: KnowledgeImpactRow[]
  summary: {
    totalKnowledge: number
    totalUsed: number
    totalSold: number
    avgCloseRate: number
  }
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

export default function KnowledgeImpactPanel({ businessId }: { businessId: string }) {
  const [data, setData] = useState<KnowledgeImpactResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const result = await adminFetch<KnowledgeImpactResponse>('/api/admin/analytics/knowledge-impact', businessId)
        if (!cancelled) setData(result)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error cargando impacto')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [businessId])

  if (loading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Cargando impacto del conocimiento...</div>
  }

  if (error) {
    return <div className="py-8 text-center text-sm text-destructive">{error}</div>
  }

  const rows = data?.impact ?? []
  const summary = data?.summary
  const hasData = rows.length > 0

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Impacto del conocimiento</h3>
        <p className="text-sm text-muted-foreground">
          Cómo el conocimiento registrado influye en las conversaciones y en el cierre de ventas.
        </p>
      </div>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">Conocimientos usados</p>
            <p className="mt-1 text-2xl font-bold">{summary.totalKnowledge}</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">Conversaciones con conocimiento</p>
            <p className="mt-1 text-2xl font-bold">{summary.totalUsed}</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">Conversaciones vendidas</p>
            <p className="mt-1 text-2xl font-bold">{summary.totalSold}</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">Tasa de cierre promedio</p>
            <p className="mt-1 text-2xl font-bold">{formatPercent(summary.avgCloseRate)}</p>
          </div>
        </div>
      )}

      {hasData ? (
        <div className="rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-3 font-medium">Conocimiento</th>
                <th className="p-3 font-medium">Categoría</th>
                <th className="p-3 text-right font-medium">Usado</th>
                <th className="p-3 text-right font-medium">Vendido</th>
                <th className="p-3 text-right font-medium">Cierre</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.knowledge_item_id} className="border-b last:border-0">
                  <td className="p-3">{row.question}</td>
                  <td className="p-3">{row.category ?? '—'}</td>
                  <td className="p-3 text-right">{row.conversations_used}</td>
                  <td className="p-3 text-right">{row.conversations_sold}</td>
                  <td className="p-3 text-right font-medium">{formatPercent(row.close_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
          Todavía no hay conversaciones registradas con conocimiento usado.
        </div>
      )}
    </div>
  )
}