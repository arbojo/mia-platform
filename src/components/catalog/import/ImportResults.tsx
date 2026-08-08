'use client'

import { Badge } from '@/components/ui/badge'
import type { ImportError, ImportSummary, PreviewResult } from '@/lib/import/types'

interface ImportResultsProps {
  preview?: PreviewResult | null
  summary?: ImportSummary | null
}

function ErrorList({ errors }: { errors: ImportError[] }) {
  return (
    <div className="max-h-40 overflow-y-auto rounded-lg border border-red-100 bg-red-50 p-3">
      <ul className="space-y-1 text-sm text-red-700">
        {errors.slice(0, 50).map((error, index) => (
          <li key={index}>
            <span className="font-medium">Fila {error.row}:</span> {error.message}
          </li>
        ))}
        {errors.length > 50 && <li className="text-red-500">…y {errors.length - 50} errores más</li>}
      </ul>
    </div>
  )
}

export function ImportResults({ preview, summary }: ImportResultsProps) {
  if (preview) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Encontrados: {preview.total}</Badge>
          <Badge variant="outline">Previsualizados: {preview.rows.length}</Badge>
          <Badge variant="secondary">Omitidos: {preview.skipped}</Badge>
          <Badge variant="destructive">Errores: {preview.errors.length}</Badge>
          {preview.stockDropped > 0 && (
            <Badge variant="secondary">Stock descartado: {preview.stockDropped}</Badge>
          )}
        </div>
        {preview.errors.length > 0 && <ErrorList errors={preview.errors} />}
      </div>
    )
  }

  if (summary) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-olive-600 text-white">Creados: {summary.created}</Badge>
          <Badge className="bg-blue-600 text-white">Actualizados: {summary.updated}</Badge>
          <Badge variant="secondary">Omitidos: {summary.skipped}</Badge>
          <Badge variant="destructive">Errores: {summary.errors.length}</Badge>
          {summary.stockDropped > 0 && (
            <Badge variant="secondary">Stock descartado: {summary.stockDropped}</Badge>
          )}
        </div>
        {summary.errors.length > 0 && <ErrorList errors={summary.errors} />}
      </div>
    )
  }

  return null
}
