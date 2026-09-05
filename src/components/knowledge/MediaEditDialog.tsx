'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SuccessPop } from '@/components/ui/success-pop'
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
type MediaType = 'image' | 'testimonial'

const mediaTypes: Array<{ id: MediaType; label: string }> = [
  { id: 'image', label: 'Imagen' },
  { id: 'testimonial', label: 'Testimonio' },
]

interface MediaEditDialogProps {
  item: KnowledgeItem | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function MediaEditDialog({ item, onOpenChange, onSaved }: MediaEditDialogProps) {
  const [type, setType] = useState<MediaType>((item?.media_type as MediaType) ?? 'image')
  const [description, setDescription] = useState(item?.answer ?? '')
  const [trigger, setTrigger] = useState(item?.trigger_condition ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    if (!item || !description.trim()) return
    setSaving(true)
    const res = await fetch(`/api/knowledge/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answer: description,
        trigger_condition: trigger.trim() || null,
        media_type: type,
      }),
    })
    if (res.ok) {
      setSaved(true)
      window.setTimeout(() => {
        onOpenChange(false)
        onSaved()
        setSaved(false)
      }, 900)
    }
    setSaving(false)
  }

  return (
    <AlertDialog
      open={!!item}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Editar medio</AlertDialogTitle>
          <AlertDialogDescription>
            Actualiza el tipo, la descripción semántica y la condición de envío.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de medio</Label>
            <div className="flex flex-wrap gap-2">
              {mediaTypes.map((t) => (
                <Button
                  key={t.id}
                  variant={type === t.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setType(t.id)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="media-edit-desc">Descripción semántica</Label>
            <Textarea
              id="media-edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="media-edit-trigger">Condición de envío (opcional)</Label>
            <Input
              id="media-edit-trigger"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              Opcional. La condición refina cuándo se envía el medio; sin condición, acompaña al producto en el chat.
            </p>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleSave} disabled={saving || !description.trim()}>
            {saving ? 'Guardando...' : 'Guardar'}
          </AlertDialogAction>
        </AlertDialogFooter>
        {saved && <SuccessPop message="Medio actualizado" />}
      </AlertDialogContent>
    </AlertDialog>
  )
}
