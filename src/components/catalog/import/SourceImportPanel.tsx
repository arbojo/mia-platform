'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ImportSummary, PreviewResult, SourceMethod } from '@/lib/import/types'

interface SourceImportPanelProps {
  businessId: string
  onPreview: (preview: PreviewResult) => void
  onImported: (summary: ImportSummary) => void
}

const METHOD_LABELS: Record<SourceMethod, string> = {
  woocommerce: 'Tienda WooCommerce',
  feed: 'Feed de productos (RSS/XML)',
  scrape: 'Página web (scraping)',
}

const METHOD_HINTS: Record<SourceMethod, string> = {
  woocommerce:
    'URL de tu tienda (ej. https://mishop.com). Usa la API pública o credenciales de consumidor.',
  feed: 'URL del feed XML de productos (RSS, Atom, Google Shopping o XML genérico).',
  scrape: 'URL del listado de la página web. Se detectan tarjetas de producto automáticamente.',
}

export function SourceImportPanel({ businessId, onPreview, onImported }: SourceImportPanelProps) {
  const [method, setMethod] = useState<SourceMethod>('woocommerce')
  const [url, setUrl] = useState('')
  const [consumerKey, setConsumerKey] = useState('')
  const [consumerSecret, setConsumerSecret] = useState('')
  const [cardSelector, setCardSelector] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const post = async (mode: 'preview' | 'import') => {
    if (!url.trim()) {
      setError('Ingresa la URL de la fuente')
      return
    }
    setLoading(true)
    setError(null)

    const payload = {
      business_id: businessId,
      method,
      url: url.trim(),
      mode,
      credentials: consumerKey.trim() ? { consumerKey: consumerKey.trim(), consumerSecret: consumerSecret.trim() } : undefined,
      selectors: cardSelector.trim() ? { card: cardSelector.trim() } : undefined,
    }

    try {
      const res = await fetch('/api/catalog/import/source', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json().catch(() => ({}))) as {
        preview?: PreviewResult
        summary?: ImportSummary
        error?: string
      }
      if (!res.ok) {
        setError(data.error ?? 'No se pudo conectar con la fuente')
        return
      }
      if (mode === 'preview' && data.preview) onPreview(data.preview)
      else if (mode === 'import' && data.summary) onImported(data.summary)
    } catch {
      setError('Error de red al conectar con la fuente')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="import-source-method">Tipo de fuente</Label>
        <Select value={method} onValueChange={(value) => setMethod(value as SourceMethod)}>
          <SelectTrigger id="import-source-method" className="w-full">
            <SelectValue placeholder="Selecciona el tipo de fuente" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(METHOD_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-zinc-400">{METHOD_HINTS[method]}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="import-source-url">URL</Label>
        <Input
          id="import-source-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
        />
      </div>

      {method === 'woocommerce' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="import-source-key">Consumer Key (opcional)</Label>
            <Input
              id="import-source-key"
              value={consumerKey}
              onChange={(e) => setConsumerKey(e.target.value)}
              placeholder="ck_…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="import-source-secret">Consumer Secret (opcional)</Label>
            <Input
              id="import-source-secret"
              type="password"
              value={consumerSecret}
              onChange={(e) => setConsumerSecret(e.target.value)}
              placeholder="cs_…"
            />
          </div>
        </div>
      )}

      {method === 'scrape' && (
        <div className="space-y-2">
          <Label htmlFor="import-source-selector">Selector de tarjetas (opcional)</Label>
          <Input
            id="import-source-selector"
            value={cardSelector}
            onChange={(e) => setCardSelector(e.target.value)}
            placeholder=".product-card"
          />
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button variant="outline" disabled={loading} onClick={() => post('preview')}>
          Vista previa
        </Button>
        <Button
          className="bg-brand-600 hover:bg-brand-700"
          disabled={loading}
          onClick={() => post('import')}
        >
          {loading ? 'Procesando…' : 'Importar'}
        </Button>
      </div>
    </div>
  )
}
