'use client'

import { useState } from 'react'
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

const categories = [
  { id: 'business_info', label: 'Info del Negocio' },
  { id: 'faq', label: 'Preguntas Frecuentes' },
  { id: 'objection', label: 'Manejo de Objeciones' },
  { id: 'process', label: 'Procesos' },
  { id: 'tip', label: 'Consejos' },
]

interface KnowledgeManagerProps {
  businessId: string
  initialItems: KnowledgeItem[]
}

export function KnowledgeManager({ businessId, initialItems }: KnowledgeManagerProps) {
  const [items, setItems] = useState<KnowledgeItem[]>(initialItems)
  const [loading, setLoading] = useState(false)
  const [category, setCategory] = useState<string>('faq')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [triggerCondition, setTriggerCondition] = useState('')
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeItem | null>(null)
  const [editTarget, setEditTarget] = useState<KnowledgeItem | null>(null)
  const [editQuestion, setEditQuestion] = useState('')
  const [editAnswer, setEditAnswer] = useState('')
  const [editCategory, setEditCategory] = useState<string>('faq')
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null)
  const [editTriggerCondition, setEditTriggerCondition] = useState('')

  const filteredItems = items.filter((item) => {
    const matchesCategory = !filterCategory || item.category === filterCategory
    const matchesSearch = !search ||
      item.question.toLowerCase().includes(search.toLowerCase()) ||
      item.answer.toLowerCase().includes(search.toLowerCase())
    return matchesCategory && matchesSearch
  })

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

      const { error } = await res.json()
      console.error('Upload failed:', error)
      return null
    } finally {
      setUploading(false)
    }
  }

  const handleAdd = async () => {
    if (!question.trim() || !answer.trim()) return
    setLoading(true)

    const res = await fetch('/api/knowledge/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_id: businessId,
        category,
        question,
        answer,
        image_url: imageUrl,
        trigger_condition: triggerCondition.trim() || null,
      }),
    })

    if (res.ok) {
      const { item } = await res.json()
      setItems((prev) => [item, ...prev])
      setQuestion('')
      setAnswer('')
      setImageUrl(null)
      setTriggerCondition('')
    }

    setLoading(false)
  }

  const handleEdit = async () => {
    if (!editTarget || !editQuestion.trim() || !editAnswer.trim()) return
    setLoading(true)

    const res = await fetch(`/api/knowledge/items/${editTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: editCategory,
        question: editQuestion,
        answer: editAnswer,
        image_url: editImageUrl,
        trigger_condition: editTriggerCondition.trim() || null,
      }),
    })

    if (res.ok) {
      const { item } = await res.json()
      setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)))
      setEditTarget(null)
    }

    setLoading(false)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    const res = await fetch(`/api/knowledge/items/${deleteTarget.id}`, {
      method: 'DELETE',
    })

    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id))
      setDeleteTarget(null)
    }
  }

  const startEdit = (item: KnowledgeItem) => {
    setEditTarget(item)
    setEditQuestion(item.question)
    setEditAnswer(item.answer)
    setEditCategory(item.category)
    setEditImageUrl(item.image_url)
    setEditTriggerCondition(item.trigger_condition ?? '')
  }

  const getCategoryLabel = (id: string) =>
    categories.find((c) => c.id === id)?.label ?? id

  return (
    <div className="space-y-6">
      <div className="p-4 border rounded-xl bg-gray-50 space-y-4">
        <div className="space-y-2">
          <Label>Categoría</Label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={category === cat.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCategory(cat.id)}
              >
                {cat.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="question">Pregunta / Tema</Label>
          <Input
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="¿Qué pregunta responde esta información?"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="answer">Respuesta / Información</Label>
          <Textarea
            id="answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="La información que MIA debe conocer..."
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="image">Imagen condicional (opcional)</Label>
          <Input
            id="image"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleUpload(file).then((url) => url && setImageUrl(url))
            }}
          />
          {imageUrl && (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Vista previa" className="h-16 w-16 rounded-lg object-cover" />
              <Button variant="outline" size="sm" onClick={() => setImageUrl(null)}>
                Quitar imagen
              </Button>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="trigger">Condición de envío (opcional)</Label>
          <Input
            id="trigger"
            value={triggerCondition}
            onChange={(e) => setTriggerCondition(e.target.value)}
            placeholder="Ej: precio, aspecto físico, testimonio, resultados"
          />
          <p className="text-xs text-gray-500">
            La imagen se enviará automáticamente la primera vez que el cliente mencione este tema en una conversación.
          </p>
        </div>
        <Button
          onClick={handleAdd}
          disabled={
            loading ||
            !question.trim() ||
            !answer.trim() ||
            uploading ||
            (!!imageUrl && !triggerCondition.trim())
          }
          className="bg-violet-600 hover:bg-violet-700"
        >
          {loading ? 'Agregando...' : 'Agregar conocimiento'}
        </Button>
      </div>

      <div className="flex gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar conocimiento..."
          className="flex-1"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">Todas las categorías</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {filteredItems.map((item) => (
          <div key={item.id} className="p-4 border rounded-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">{getCategoryLabel(item.category)}</Badge>
                  <Badge variant="outline">{item.source}</Badge>
                </div>
                <h3 className="font-medium text-gray-900">{item.question}</h3>
                <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{item.answer}</p>
                {item.image_url && (
                  <div className="mt-3 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image_url}
                      alt={item.question}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                    {item.trigger_condition && (
                      <Badge variant="outline" className="text-xs">
                        Se envía cuando mencione: {item.trigger_condition}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => startEdit(item)}>
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteTarget(item)}
                  className="text-red-600 hover:text-red-700"
                >
                  Eliminar
                </Button>
              </div>
            </div>
          </div>
        ))}
        {filteredItems.length === 0 && (
          <div className="text-center py-8">
            {items.length === 0 ? (
              <div className="space-y-3">
                <p className="text-lg text-zinc-700">
                  I don&apos;t know anything about your business yet.
                </p>
                <p className="text-sm text-zinc-500">
                  Teach me things like FAQs, shipping policies, or product details.
                </p>
                <p className="text-sm text-zinc-500">
                  The more you teach me, the better I can help your customers.
                </p>
              </div>
            ) : (
              <p className="text-gray-500">
                No results found.
              </p>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar conocimiento</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar este conocimiento? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Editar conocimiento</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={editCategory === cat.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setEditCategory(cat.id)}
                  >
                    {cat.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Pregunta / Tema</Label>
              <Input
                value={editQuestion}
                onChange={(e) => setEditQuestion(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Respuesta / Información</Label>
              <Textarea
                value={editAnswer}
                onChange={(e) => setEditAnswer(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Imagen condicional</Label>
              {editImageUrl ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={editImageUrl}
                    alt="Vista previa"
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                  <Button variant="outline" size="sm" onClick={() => setEditImageUrl(null)}>
                    Quitar imagen
                  </Button>
                </div>
              ) : (
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void handleUpload(file).then((url) => url && setEditImageUrl(url))
                  }}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Condición de envío</Label>
              <Input
                value={editTriggerCondition}
                onChange={(e) => setEditTriggerCondition(e.target.value)}
                placeholder="Ej: precio, aspecto físico, testimonio, resultados"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEdit} disabled={loading}>
              Guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
