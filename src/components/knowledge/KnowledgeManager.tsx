'use client'

import { useState, useCallback } from 'react'
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
import { KnowledgeItemDialog } from '@/components/knowledge/KnowledgeItemDialog'
import type { KnowledgeItemFormValues } from '@/components/knowledge/KnowledgeItemDialog'
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
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<'active' | 'inactive' | 'all'>('active')
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeItem | null>(null)
  const [editTarget, setEditTarget] = useState<KnowledgeItem | null>(null)

  const reloadItems = useCallback(async (status: 'active' | 'inactive' | 'all') => {
    const params = new URLSearchParams({ business_id: businessId, status })
    if (filterCategory) params.set('category', filterCategory)
    const res = await fetch(`/api/knowledge/items?${params.toString()}`)
    if (res.ok) {
      const { items: fetched } = await res.json()
      setItems(fetched)
    }
  }, [businessId, filterCategory])

  const filteredItems = items.filter((item) => {
    const matchesCategory = !filterCategory || item.category === filterCategory
    const matchesSearch = !search ||
      item.question.toLowerCase().includes(search.toLowerCase()) ||
      item.answer.toLowerCase().includes(search.toLowerCase())
    return matchesCategory && matchesSearch
  })

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
      }),
    })

    if (res.ok) {
      const { item } = await res.json()
      setItems((prev) => [item, ...prev])
      setQuestion('')
      setAnswer('')
    }

    setLoading(false)
  }

  const handleEditValues = async (values: KnowledgeItemFormValues) => {
    if (!editTarget) return
    setLoading(true)

    const res = await fetch(`/api/knowledge/items/${editTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: values.category,
        question: values.question,
        answer: values.answer,
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

  const handleToggleActive = async (item: KnowledgeItem) => {
    const res = await fetch(`/api/knowledge/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !item.is_active }),
    })

    if (res.ok) {
      if (filterStatus === 'all') {
        const { item: updated } = await res.json()
        setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
      } else {
        setItems((prev) => prev.filter((i) => i.id !== item.id))
      }
    }
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
        <Button
          onClick={handleAdd}
          disabled={loading || !question.trim() || !answer.trim()}
          className="bg-olive-600 hover:bg-olive-700"
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
        <select
          value={filterStatus}
          onChange={(e) => {
            const next = e.target.value as 'active' | 'inactive' | 'all'
            setFilterStatus(next)
            void reloadItems(next)
          }}
          className="px-3 py-2 border rounded-lg text-sm"
          aria-label="Filtrar por estado"
        >
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="all">Todos</option>
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
                  {item.is_active ? (
                    <Badge className="bg-green-600">Activo</Badge>
                  ) : (
                    <Badge variant="outline" className="text-gray-500">Inactivo</Badge>
                  )}
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
                <Button variant="ghost" size="sm" onClick={() => setEditTarget(item)}>
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggleActive(item)}
                  className={item.is_active ? 'text-amber-600 hover:text-amber-700' : 'text-green-600 hover:text-green-700'}
                >
                  {item.is_active ? 'Desactivar' : 'Activar'}
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

      <KnowledgeItemDialog
        key={editTarget?.id ?? 'none'}
        open={!!editTarget}
        onOpenChange={(o) => { if (!o) setEditTarget(null) }}
        kind="knowledge"
        initial={editTarget ? {
          category: editTarget.category,
          question: editTarget.question,
          answer: editTarget.answer,
        } : undefined}
        title="Editar conocimiento"
        submitLabel="Guardar"
        submitting={loading}
        onSubmit={handleEditValues}
      />
    </div>
  )
}
