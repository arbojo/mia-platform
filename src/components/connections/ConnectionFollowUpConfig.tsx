'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

interface FollowUpConfigProps {
  connectionId: string
  configuration?: Record<string, unknown>
  onUpdated: () => void
}

export function ConnectionFollowUpConfig({
  connectionId,
  configuration,
  onUpdated,
}: FollowUpConfigProps) {
  const cfg = configuration ?? {}
  const [enabled, setEnabled] = useState<'enabled' | 'disabled'>(
    cfg.follow_up_enabled === true ? 'enabled' : 'disabled'
  )
  const [delayMinutes, setDelayMinutes] = useState(
    String(cfg.follow_up_delay_minutes ?? 1440)
  )
  const [template, setTemplate] = useState(String(cfg.follow_up_template ?? ''))
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const delay = Number(delayMinutes)
      const next: Record<string, unknown> = {
        follow_up_enabled: enabled === 'enabled',
        follow_up_delay_minutes: Number.isFinite(delay) && delay > 0 ? delay : 1440,
        follow_up_template: template.trim() || null,
      }
      const res = await fetch('/api/channels/connections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, configuration: next }),
      })
      if (res.ok) onUpdated()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-t pt-3 mt-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Seguimiento por inactividad</Label>
          <p className="text-xs text-muted-foreground">
            Recontacta a clientes que no han interactuado con el canal.
          </p>
        </div>
        <Select value={enabled} onValueChange={(v) => setEnabled(v as 'enabled' | 'disabled')}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="disabled">Desactivado</SelectItem>
            <SelectItem value="enabled">Activado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {enabled === 'enabled' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Inactividad (minutos)</Label>
              <Input
                type="number"
                min={1}
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mensaje (opcional)</Label>
            <Input
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder="Hola {name}, ¿seguís interesado? ..."
            />
            <p className="text-xs text-muted-foreground">
              Si se deja vacío, MIA genera el mensaje automáticamente.
            </p>
          </div>
        </>
      )}

      <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
        {saving ? 'Guardando...' : 'Guardar'}
      </Button>
    </div>
  )
}
