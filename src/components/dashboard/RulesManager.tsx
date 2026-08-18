'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
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

type SalesRule = Database['public']['Tables']['sales_rules']['Row']

const categories = [
  { id: 'zones', label: 'Zonas de envío' },
  { id: 'payment', label: 'Métodos de pago' },
  { id: 'schedule', label: 'Horarios' },
  { id: 'promotions', label: 'Promociones' },
  { id: 'restrictions', label: 'Restricciones' },
  { id: 'escalation', label: 'Escalación a humano' },
]

interface RulesManagerProps {
  businessId: string
  initialRules: SalesRule[]
}

export function RulesManager({ businessId, initialRules }: RulesManagerProps) {
  const [rules, setRules] = useState<SalesRule[]>(initialRules)
  const [loading, setLoading] = useState(false)
  const [category, setCategory] = useState('zones')
  const [content, setContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SalesRule | null>(null)

  const supabase = createClient()

  const invalidateCache = () => {
    fetch('/api/cache/invalidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: businessId }),
    }).catch(() => {})
  }

  const resetForm = () => {
    setContent('')
    setCategory('zones')
    setEditingId(null)
  }

  const startEdit = (rule: SalesRule) => {
    setEditingId(rule.id)
    setCategory(rule.category)
    setContent(rule.content)
  }

  const handleSave = async () => {
    if (!content.trim()) return
    setLoading(true)

    const payload = {
      category: category as SalesRule['category'],
      content,
    }

    if (editingId) {
      const { error } = await supabase
        .from('sales_rules')
        .update(payload)
        .eq('id', editingId)

      if (!error) {
        setRules((prev) =>
          prev.map((r) => (r.id === editingId ? { ...r, ...payload } : r))
        )
        resetForm()
        invalidateCache()
      }
    } else {
      const { data, error } = await supabase
        .from('sales_rules')
        .insert({ business_id: businessId, ...payload })
        .select()
        .single()

      if (!error && data) {
        setRules((prev) => [data, ...prev])
        resetForm()
        invalidateCache()
      }
    }

    setLoading(false)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    await supabase.from('sales_rules').delete().eq('id', deleteTarget.id)
    setRules((prev) => prev.filter((r) => r.id !== deleteTarget.id))
    setDeleteTarget(null)
    invalidateCache()
  }

  return (
    <div className="space-y-6">
      <div className="p-4 border rounded-xl bg-gray-50 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">
            {editingId ? 'Editar regla' : 'Nueva regla'}
          </h3>
          {editingId && (
            <Button variant="ghost" size="sm" onClick={resetForm}>
              Cancelar
            </Button>
          )}
        </div>
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
          <Label htmlFor="content">Regla</Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Ej: Solo hacemos envíos a León y Silao"
          />
        </div>
        <Button
          onClick={handleSave}
          disabled={loading || !content.trim()}
          className="bg-brand-600 hover:bg-brand-700"
        >
          {loading ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Agregar regla'}
        </Button>
      </div>

      <div className="space-y-3">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="flex items-start justify-between p-4 border rounded-xl"
          >
            <div className="flex-1">
              <Badge variant="secondary" className="mb-2">
                {categories.find((c) => c.id === rule.category)?.label ?? rule.category}
              </Badge>
              <p className="text-gray-900">{rule.content}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startEdit(rule)}
              >
                Editar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteTarget(rule)}
                className="text-red-600 hover:text-red-700"
              >
                Eliminar
              </Button>
            </div>
          </div>
        ))}
        {rules.length === 0 && (
          <div className="text-center py-8">
            <div className="space-y-3">
              <p className="text-lg text-zinc-700">
                Aún no sé cómo opera tu negocio.
              </p>
              <p className="text-sm text-zinc-500">
                Enséñame las reglas más importantes: métodos de pago, zonas de envío, horarios o promociones.
              </p>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar regla</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar esta regla? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
