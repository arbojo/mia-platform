'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, FileSpreadsheet } from 'lucide-react'
import type { ImportSummary } from '@/lib/import/types'

interface FileImportPanelProps {
  businessId: string
  onImported: (summary: ImportSummary) => void
}

export function FileImportPanel({ businessId, onImported }: FileImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFileName(event.target.files?.[0]?.name ?? null)
    setError(null)
  }

  const handleSubmit = async () => {
    const file = inputRef.current?.files?.[0]
    if (!file) return
    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append('business_id', businessId)
    formData.append('file', file)

    try {
      const res = await fetch('/api/catalog/import/file', { method: 'POST', body: formData })
      const data = (await res.json().catch(() => ({}))) as { summary?: ImportSummary; error?: string }
      if (!res.ok) {
        setError(data.error ?? 'No se pudo importar el archivo')
        return
      }
      if (data.summary) onImported(data.summary)
    } catch {
      setError('Error de red al importar el archivo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">
        Sube un archivo <strong>.csv</strong> o <strong>.xlsx</strong> con columnas de nombre, SKU,
        precio, descripción, beneficios e imagen. Las columnas se detectan automáticamente en
        español e inglés. Máximo 5 MB.
      </p>

      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx"
          className="hidden"
          id="import-file-input"
          onChange={handleFileChange}
        />
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" />
          {fileName ?? 'Seleccionar archivo'}
        </Button>
        {fileName && (
          <span className="flex items-center gap-1 text-sm text-zinc-500">
            <FileSpreadsheet className="h-4 w-4" />
            {fileName}
          </span>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button
        className="bg-brand-600 hover:bg-brand-700"
        disabled={!fileName || loading}
        onClick={handleSubmit}
      >
        {loading ? 'Importando…' : 'Importar archivo'}
      </Button>
      {fileName && (
        <p className="text-xs text-zinc-400">
          Los productos con SKU existente se actualizan; los nuevos se agregan.
        </p>
      )}
    </div>
  )
}
