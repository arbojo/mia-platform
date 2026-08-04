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

type AiInstruction = Database['public']['Tables']['ai_instructions']['Row']

interface InstructionsManagerProps {
  businessId: string
  initialItems: AiInstruction[]
}

export function InstructionsManager({ businessId, initialItems }: InstructionsManagerProps) {
  const [items, setItems] = useState<AiInstruction[]>(initialItems)
  const [loading, setLoading] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [priority, setPriority] = useState('0')
  const [deleteTarget, setDeleteTarget] = useState<AiInstruction | null>(null)
  const [editTarget, setEditTarget] = useState<AiInstruction | null>(null)
  const [editInstruction, setEditInstruction] = useState('')
  const [editPriority, setEditPriority] = useState('0')

  const handleAdd = async () => {
    if (!instruction.trim()) return
    setLoading(true)

    const res = await fetch('/api/knowledge/instructions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_id: businessId,
        instruction,
        priority: parseInt(priority) || 0,
      }),
    })

    if (res.ok) {
      const { item } = await res.json()
      setItems((prev) => [...prev, item].sort((a, b) => b.priority - a.priority))
      setInstruction('')
      setPriority('0')
    }

    setLoading(false)
  }

  const handleEdit = async () => {
    if (!editTarget || !editInstruction.trim()) return
    setLoading(true)

    const res = await fetch(`/api/knowledge/instructions/${editTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instruction: editInstruction,
        priority: parseInt(editPriority) || 0,
      }),
    })

    if (res.ok) {
      const { item } = await res.json()
      setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)).sort((a, b) => b.priority - a.priority))
      setEditTarget(null)
    }

    setLoading(false)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    const res = await fetch(`/api/knowledge/instructions/${deleteTarget.id}`, {
      method: 'DELETE',
    })

    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id))
      setDeleteTarget(null)
    }
  }

  const handlePriorityChange = async (item: AiInstruction, newPriority: number) => {
    const res = await fetch(`/api/knowledge/instructions/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority: newPriority }),
    })

    if (res.ok) {
      const { item: updated } = await res.json()
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)).sort((a, b) => b.priority - a.priority))
    }
  }

  const startEdit = (item: AiInstruction) => {
    setEditTarget(item)
    setEditInstruction(item.instruction)
    setEditPriority(String(item.priority))
  }

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      manual: 'Manual',
      onboarding: 'Onboarding',
      correction: 'Corrección',
    }
    return labels[source] ?? source
  }

  return (
    <div className="space-y-6">
      <div className="p-4 border rounded-xl bg-gray-50 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="instruction">Instrucción para MIA</Label>
          <Textarea
            id="instruction"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Ej: Siempre saluda con el nombre del cliente. Nunca inventes precios."
            rows={3}
          />
        </div>
        <div className="flex items-end gap-4">
          <div className="space-y-2 w-32">
            <Label htmlFor="priority">Prioridad</Label>
            <Input
              id="priority"
              type="number"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              min="0"
            />
          </div>
          <Button
            onClick={handleAdd}
            disabled={loading || !instruction.trim()}
            className="bg-olive-600 hover:bg-olive-700"
          >
            {loading ? 'Agregando...' : 'Agregar instrucción'}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="p-4 border rounded-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">Prioridad: {item.priority}</Badge>
                  <Badge variant="outline">{getSourceLabel(item.source)}</Badge>
                </div>
                <p className="text-gray-900 whitespace-pre-wrap">{item.instruction}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePriorityChange(item, item.priority + 1)}
                  title="Aumentar prioridad"
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePriorityChange(item, Math.max(0, item.priority - 1))}
                  title="Disminuir prioridad"
                >
                  ↓
                </Button>
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
        {items.length === 0 && (
          <div className="text-center py-8">
            <div className="space-y-3">
              <p className="text-lg text-zinc-700">
                I don&apos;t know how you want me to speak with customers yet.
              </p>
              <p className="text-sm text-zinc-500">
                Add instructions like &quot;Always be friendly&quot; or &quot;Offer discounts for bulk orders&quot;.
              </p>
              <p className="text-sm text-zinc-500">
                These help me understand your communication style.
              </p>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar instrucción</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar esta instrucción? Esta acción no se puede deshacer.
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
            <AlertDialogTitle>Editar instrucción</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Instrucción</Label>
              <Textarea
                value={editInstruction}
                onChange={(e) => setEditInstruction(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Input
                type="number"
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value)}
                min="0"
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
