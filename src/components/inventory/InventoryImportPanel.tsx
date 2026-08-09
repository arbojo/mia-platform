'use client'

import { useRef, useState } from 'react'

interface ImportSummary {
  total: number
  applied: number
  skipped: number
  errors: Array<{ row: number; message: string; sku?: string }>
}

export function InventoryImportPanel({ businessId }: { businessId: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onFileSelected(file: File) {
    setImporting(true)
    setError(null)
    setSummary(null)
    try {
      const formData = new FormData()
      formData.append('business_id', businessId)
      formData.append('file', file)

      const res = await fetch('/api/admin/inventory/import', {
        method: 'POST',
        body: formData,
        cache: 'no-store',
      })

      const body = (await res.json().catch(() => ({}))) as
        | { summary?: ImportSummary; error?: string }
        | undefined

      if (!res.ok) {
        throw new Error(body?.error ?? `Error ${res.status}`)
      }

      setSummary(body?.summary ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al importar')
    } finally {
      setImporting(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
          Importar stock (CSV o XLSX)
        </p>
        <p className="text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
          Columnas: SKU y cantidad de stock. Actualiza el stock inicial de todos los productos de
          una vez.
        </p>

        <div className="mt-3 flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx"
            disabled={importing}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void onFileSelected(file)
            }}
            className="text-sm"
          />
          {importing && (
            <span className="text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
              Importando…
            </span>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {summary && (
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
            Resultado de la importación
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--atmosphere-text)' }}>
            Total: {summary.total} · Aplicados: {summary.applied} · Omitidos: {summary.skipped}
          </p>
          {summary.errors.length > 0 && (
            <div className="mt-2 space-y-1">
              {summary.errors.slice(0, 20).map((err, i) => (
                <p key={i} className="text-xs text-red-700">
                  {err.sku ? `${err.sku}: ` : ''}
                  {err.message}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
