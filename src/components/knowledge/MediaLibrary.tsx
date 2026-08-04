'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import type { Database } from '@/lib/types'

type KnowledgeItem = Database['public']['Tables']['knowledge_items']['Row']
type MediaType = 'image' | 'testimonial' | 'flyer' | 'other'

const mediaTypes: Array<{ id: MediaType; label: string }> = [
  { id: 'image', label: 'Imagen' },
  { id: 'testimonial', label: 'Testimonio' },
  { id: 'flyer', label: 'Flyer' },
  { id: 'other', label: 'Otro' },
]

const mediaTypeLabel = (id: string) =>
  mediaTypes.find((t) => t.id === id)?.label ?? id

interface MediaLibraryProps {
  businessId: string
}

export function MediaLibrary({ businessId }: MediaLibraryProps) {
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [filter, setFilter] = useState<'all' | MediaType>('all')
  const [uploading, setUploading] = useState(false)
  const [uploadingName, setUploadingName] = useState('')
  const [newType, setNewType] = useState<MediaType>('image')
  const [newDescription, setNewDescription] = useState('')
  const [newTrigger, setNewTrigger] = useState('')
  const [editTarget, setEditTarget] = useState<KnowledgeItem | null>(null)
  const [editType, setEditType] = useState<MediaType>('image')
  const [editDescription, setEditDescription] = useState('')
  const [editTrigger, setEditTrigger] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeItem | null>(null)

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
  }, [businessId, filter, refreshKey])

  const handleUpload = async (file: File): Promise<string | null> => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('business_id', businessId)
      formData.append('file', file)
      const res = await fetch('/api/knowledge/media/upload', {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        const { url } = await res.json()
        return url
      }
      return null
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = await handleUpload(file)
    if (!url) return
    if (!newDescription.trim() || !newTrigger.trim()) {
      setUploadingName(url)
      return
    }
    await handleCreateItem(url)
  }

  const handleCreateItem = async (url: string) => {
    if (!newDescription.trim() || !newTrigger.trim()) return
    const res = await fetch('/api/knowledge/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_id: businessId,
        category: 'tip',
        question: `Multimedia: ${newType}`,
        answer: newDescription,
        image_url: url,
        trigger_condition: newTrigger,
        media_type: newType,
      }),
    })
    if (res.ok) {
      setNewDescription('')
      setNewTrigger('')
      setUploadingName('')
      setRefreshKey((k) => k + 1)
    }
  }

  const startEdit = (item: KnowledgeItem) => {
    setEditTarget(item)
    setEditType((item.media_type as MediaType) ?? 'other')
    setEditDescription(item.answer)
    setEditTrigger(item.trigger_condition ?? '')
  }

  const handleEdit = async () => {
    if (!editTarget || !editDescription.trim()) return
    const res = await fetch(`/api/knowledge/items/${editTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answer: editDescription,
        trigger_condition: editTrigger.trim() || null,
        media_type: editType,
      }),
    })
    if (res.ok) {
      setEditTarget(null)
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

  const canCreate = uploadingName !== '' && newDescription.trim() && newTrigger.trim()

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="p-4 border rounded-xl bg-gray-50 space-y-4">
          <h3 className="font-semibold text-gray-900">Subir nuevo medio</h3>
          <div className="space-y-2">
            <Label htmlFor="media-file">Archivo</Label>
            <Input
              id="media-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={uploading}
              onChange={handleFileChange}
            />
            {uploadingName && (
              <p className="text-xs text-green-600">Imagen subida. Completa los datos.</p>
            )}
          </div>
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
            <Label htmlFor="media-trigger">Condición de envío</Label>
            <Input
              id="media-trigger"
              value={newTrigger}
              onChange={(e) => setNewTrigger(e.target.value)}
              placeholder="Ej: resultados, antes y después, testimonio"
            />
          </div>
          <Button
            onClick={() => uploadingName && handleCreateItem(uploadingName)}
            disabled={!canCreate}
            className="bg-olive-600 hover:bg-olive-700 w-full"
          >
            Guardar medio
          </Button>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Biblioteca multimedia</h3>
            <div className="flex gap-2">
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
            <p className="text-center text-gray-500 py-8">Cargando medios...</p>
          ) : error ? (
            <p className="text-center text-red-500 py-8">{error}</p>
          ) : items.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              {filter === 'all'
                ? 'Aún no hay medios subidos. Usa el panel para subir el primero.'
                : `No hay medios de tipo ${mediaTypeLabel(filter)}.`}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {items.map((item) => (
                <div key={item.id} className="border rounded-xl overflow-hidden bg-white">
                  {item.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image_url}
                      alt={item.answer}
                      className="h-40 w-full object-cover"
                    />
                  )}
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{mediaTypeLabel(item.media_type)}</Badge>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => startEdit(item)}>
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600"
                          onClick={() => setDeleteTarget(item)}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-2">{item.answer}</p>
                    {item.trigger_condition && (
                      <p className="text-xs text-gray-500">
                        Se envía cuando: <span className="text-olive-600">{item.trigger_condition}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Editar medio</AlertDialogTitle>
            <AlertDialogDescription>
              Actualiza el tipo, la descripción y la condición de envío.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de medio</Label>
              <div className="flex flex-wrap gap-2">
                {mediaTypes.map((t) => (
                  <Button
                    key={t.id}
                    variant={editType === t.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setEditType(t.id)}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Descripción semántica</Label>
              <Textarea
                id="edit-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-trigger">Condición de envío</Label>
              <Input
                id="edit-trigger"
                value={editTrigger}
                onChange={(e) => setEditTrigger(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEdit}>Guardar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este medio?</AlertDialogTitle>
            <AlertDialogDescription>
              El medio dejará de enviarse a los clientes. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 text-white hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
