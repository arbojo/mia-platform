'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { HealthReport, HealthCheckResult } from '@/lib/system/health'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const STATUS_LABELS: Record<string, string> = {
  passed: 'OK',
  warning: 'Advertencia',
  failed: 'Falló',
}

const STATUS_STYLES: Record<string, string> = {
  passed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  failed: 'bg-red-500/15 text-red-700 dark:text-red-400',
}

export function HealthDashboard() {
  const [report, setReport] = useState<HealthReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const runCheck = useCallback(async (refresh: boolean) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/system/health${refresh ? '?refresh=1' : ''}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? 'Error al consultar el estado del sistema')
      }
      const data = (await res.json()) as { report: HealthReport }
      setReport(data.report)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadLatest = async () => {
      try {
        const res = await fetch('/api/system/health', { cache: 'no-store' })
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null
          throw new Error(body?.error ?? 'Error al consultar el estado del sistema')
        }
        const data = (await res.json()) as { report: HealthReport }
        if (!cancelled) setReport(data.report)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadLatest()
    return () => {
      cancelled = true
    }
  }, [])

  function formatDate(iso?: string) {
    if (!iso) return 'sin registro'
    return new Date(iso).toLocaleString('es-AR', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button onClick={() => runCheck(true)} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Ejecutar revisión
        </Button>
        {report && (
          <Badge variant="outline" className={STATUS_STYLES[report.status]}>
            {STATUS_LABELS[report.status]}
          </Badge>
        )}
      </div>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {!error && !loading && !report && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Todavía no hay reportes de salud. Ejecuta la primera revisión.
          </CardContent>
        </Card>
      )}

      {report && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
              <CardDescription>
                Último reporte: {formatDate(report.createdAt)} · Duración total:{' '}
                {report.latencyMs} ms
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{report.summary}</p>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {report.checks.map((check: HealthCheckResult) => (
              <Card key={check.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{check.label}</CardTitle>
                    <Badge variant="outline" className={STATUS_STYLES[check.status]}>
                      {STATUS_LABELS[check.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">{check.message}</p>
                  {check.latencyMs !== null && (
                    <p className="text-xs text-muted-foreground">Latencia: {check.latencyMs} ms</p>
                  )}
                  <p className="text-xs font-mono text-muted-foreground">Origen: {check.origin}</p>
                  {check.remediation && (
                    <div className="rounded-lg border border-muted bg-muted/40 p-2 text-xs">
                      <span className="font-medium">Solución: </span>
                      {check.remediation}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
