'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { MediaUpload } from '@/components/knowledge/MediaUpload'
import { MediaGrid } from '@/components/knowledge/MediaGrid'
import { MediaEditDialog } from '@/components/knowledge/MediaEditDialog'
import type { Database } from '@/lib/types'

type KnowledgeItem = Database['public']['Tables']['knowledge_items']['Row']
type MediaType = 'image' | 'testimonial'

const mediaTypes: Array<{ id: MediaType; label: string }> = [
  { id: 'image', label: 'Imagen' },
  { id: 'testimonial', label: 'Testimonio' },
]

interface MediaBrowserProps {
  businessId: string
  header: string
  hint: string
  productId?: string | null
  productNames?: Record<string, string>
}

export function MediaBrowser({
  businessId,
  header,
  hint,
  productId,
  productNames,
}: MediaBrowserProps) {
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [filter, setFilter] = useState<'all' | MediaType>('all')
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [newType, setNewType] = useState<MediaType>('image')
  const [newDescription, setNewDescription] = useState('')
  const [newTrigger, setNewTrigger] = useState('')
  const [editTarget, setEditTarget] = useState<KnowledgeItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeItem | null>(null)

  const productScope = Boolean(productId)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const params = new URLSearchParams({
          business_id: businessId,
          has_media: 'true',
        })
        if (filter !== 'all') params.set('media_type', filter)
        if (productId) params.set('product_id', productId)
        else params.set('product_id', 'null')
        const res = await fetch(`/api/knowledge/items?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) setItems(data.items)
        } else if (!cancelled) {
          setError('No se pudieron cargar los medios.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [businessId, productId, filter, refreshKey])

  const handleCreateItem = async () => {
    if (!uploadedUrl || !newDescription.trim()) return
    const res = await fetch('/api/knowledge/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_id: businessId,
        category: 'tip',
        question: `Multimedia: ${newType}`,
        answer: newDescription,
        image_url: uploadedUrl,
        trigger_condition: newTrigger.trim() || null,
        media_type: newType,
        product_id: productId ?? null,
      }),
    })
    if (res.ok) {
      setUploadedUrl(null)
      setNewDescription('')
      setNewTrigger('')
      setRefreshKey((k) => k + 1)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const res = await fetch(`/api/knowledge/items/${deleteTarget.id}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      setDeleteTarget(null)
      setRefreshKey((k) => k + 1)
    }
  }

  const canCreate =
    Boolean(uploadedUrl) && newDescription.trim().length > 0 && (productScope || newTrigger.trim().length > 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 rounded-xl border bg-gray-50 p-4">
          <h3 className="font-semibold text-gray-900">{header}</h3>
          <p className="text-xs text-gray-500">{hint}</p>
          <div className="space-y-2">
            <Label>Tipo de medio</Label>
            <div className="flex flex-wrap gap-2">
              {mediaTypes.map((t) => (
                <Button
                  key={t.id}
                  variant={newType === t.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNewType(t.id)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>
          {uploadedUrl ? (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={uploadedUrl} alt="Vista previa" className="h-28 w-full rounded-lg object-cover" />
              <Button variant="ghost" size="sm" onClick={() => setUploadedUrl(null)}>
                Quitar imagen
              </Button>
            </div>
          ) : (
            <MediaUpload businessId={businessId} onUploaded={setUploadedUrl} />
          )}
          <div className="space-y-2">
            <Label htmlFor="media-desc">Descripción semántica</Label>
            <Textarea
              id="media-desc"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Ej: Testimonio de cliente satisfecho con resultados visibles"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="media-trigger">Condición de envío {productScope ? '(opcional)' : ''}</Label>
            <Textarea
              id="media-trigger"
              value={newTrigger}
              onChange={(e) => setNewTrigger(e.target.value)}
              placeholder="Ej: resultados, antes y después, testimonio"
              rows={2}
            />
            <p className="text-xs text-gray-500">
              {productScope
                ? 'Se envía con este producto. La condición es opcional: sin ella, el medio acompañará al producto en el chat.'
                : 'Palabras clave que activan el envío automático.'}
            </p>
          </div>
          <Button
            onClick={() => void handleCreateItem()}
            disabled={!canCreate}
            className="w-full bg-olive-600 hover:bg-olive-700"
          >
            Guardar medio
          </Button>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Biblioteca multimedia</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                Todos
              </Button>
              {mediaTypes.map((t) => (
                <Button
                  key={t.id}
                  variant={filter === t.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(t.id)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="py-8 text-center text-gray-500">Cargando medios...</p>
          ) : error ? (
            <p className="py-8 text-center text-red-500">{error}</p>
          ) : (
            <MediaGrid
              items={items}
              emptyMessage="Aún no hay medios. Usa el panel para subir el primero."
              productNames={productNames}
              onEdit={setEditTarget}
              onDelete={setDeleteTarget}
            />
          )}
        </div>
      </div>

      <MediaEditDialog
        key={editTarget?.id ?? 'none'}
        item={editTarget}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null)
        }}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este medio?</AlertDialogTitle>
            <AlertDialogDescription>
              El medio dejará de enviarse a los clientes. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
