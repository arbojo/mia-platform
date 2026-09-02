'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useI18n } from '@/components/dashboard/I18nProvider'
import { Check } from 'lucide-react'

interface SalesConfig {
  ask_address: boolean
  ask_phone: boolean
  confirmation_message: string
  allow_cancellation: boolean
  cancellation_window_hours: number
  cancellation_message: string
  retention_discount_percent: number
  retention_discount_message: string
}

const DEFAULTS: SalesConfig = {
  ask_address: true,
  ask_phone: true,
  confirmation_message:
    '¡Tu pedido está confirmado! 🎉\n\n📦 Pedido: {order_number}\n💰 Total: {amount}\n📍 Dirección: {address}\n\nNos comunicaremos por WhatsApp para coordinar la entrega.',
  allow_cancellation: true,
  cancellation_window_hours: 24,
  cancellation_message:
    'Tu cancelación ha sido procesada. Si tienes alguna duda, escríbenos.',
  retention_discount_percent: 10,
  retention_discount_message:
    'Entiendo tu preocupación, {customer_name}. Para agradecerte tu interés, puedo ofrecerte un *{discount_percent}% de descuento* en tu pedido. ¿Te gustaría que te aplique el descuento y confirmemos tu compra?',
}

const VARIABLE_RE = /\{(\w+)\}/g

export function SalesConfigForm() {
  const { t } = useI18n()
  const [config, setConfig] = useState<SalesConfig>(DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/sales/config')
      .then((r) => r.json())
      .then((data) => {
        if (data.config) {
          setConfig({
            ask_address: data.config.ask_address ?? DEFAULTS.ask_address,
            ask_phone: data.config.ask_phone ?? DEFAULTS.ask_phone,
            confirmation_message: data.config.confirmation_message ?? DEFAULTS.confirmation_message,
            allow_cancellation: data.config.allow_cancellation ?? DEFAULTS.allow_cancellation,
            cancellation_window_hours:
              data.config.cancellation_window_hours ?? DEFAULTS.cancellation_window_hours,
            cancellation_message: data.config.cancellation_message ?? DEFAULTS.cancellation_message,
            retention_discount_percent:
              data.config.retention_discount_percent ?? DEFAULTS.retention_discount_percent,
            retention_discount_message:
              data.config.retention_discount_message ?? DEFAULTS.retention_discount_message,
          })
        }
      })
      .catch(() => {})
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/sales/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (res.ok) setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  function preview(template: string) {
    return template.replace(VARIABLE_RE, (_, key) => {
      const map: Record<string, string> = {
        order_number: 'VTA-123456',
        amount: '$2.500',
        address: 'Av. Corrientes 1234, Buenos Aires',
        phone: '+54 11 1234-5678',
        customer_name: 'Juan',
        cancel_hours: String(config.cancellation_window_hours),
        discount_percent: String(config.retention_discount_percent),
      }
      return map[key] ?? `{${key}}`
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t.settings.title}</h2>
          <p className="text-sm text-muted-foreground">{t.settings.subtitle}</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? '...' : saved ? <Check className="mr-2 h-4 w-4" /> : null}
          {saved ? t.settings.saved : t.settings.save}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t.settings.orderSection}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="ask_address">{t.settings.askAddress}</Label>
              <Switch
                id="ask_address"
                checked={config.ask_address}
                onCheckedChange={(v) => setConfig((c) => ({ ...c, ask_address: v }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="ask_phone">{t.settings.askPhone}</Label>
              <Switch
                id="ask_phone"
                checked={config.ask_phone}
                onCheckedChange={(v) => setConfig((c) => ({ ...c, ask_phone: v }))}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.settings.confirmationSection}</CardTitle>
            <CardDescription>{t.settings.confirmationMessage}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={config.confirmation_message}
              onChange={(e) =>
                setConfig((c) => ({ ...c, confirmation_message: e.target.value }))
              }
              rows={5}
            />
            <div className="rounded-md bg-muted p-3 text-xs">
              <p className="mb-1 font-medium">{t.settings.preview}:</p>
              <p className="whitespace-pre-wrap text-muted-foreground">
                {preview(config.confirmation_message)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{t.settings.cancellationSection}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="allow_cancellation">{t.settings.allowCancellation}</Label>
              <Switch
                id="allow_cancellation"
                checked={config.allow_cancellation}
                onCheckedChange={(v) => setConfig((c) => ({ ...c, allow_cancellation: v }))}
              />
            </div>
            {config.allow_cancellation && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="cancellation_window">{t.settings.cancellationWindow}</Label>
                  <Input
                    id="cancellation_window"
                    type="number"
                    min={1}
                    max={72}
                    value={config.cancellation_window_hours}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        cancellation_window_hours: parseInt(e.target.value, 10) || 24,
                      }))
                    }
                    className="w-32"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.settings.cancellationMessage}</Label>
                  <Textarea
                    value={config.cancellation_message}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, cancellation_message: e.target.value }))
                    }
                    rows={3}
                  />
                </div>
                <div className="border-t pt-4">
                  <p className="mb-3 text-sm font-medium">{t.settings.retentionOffer}</p>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="retention_discount_percent">
                        {t.settings.retentionDiscountPercent}
                      </Label>
                      <Input
                        id="retention_discount_percent"
                        type="number"
                        min={5}
                        max={20}
                        value={config.retention_discount_percent}
                        onChange={(e) =>
                          setConfig((c) => ({
                            ...c,
                            retention_discount_percent: Math.min(
                              20,
                              Math.max(5, parseInt(e.target.value, 10) || 10),
                            ),
                          }))
                        }
                        className="w-32"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.settings.retentionDiscountMessage}</Label>
                      <Textarea
                        value={config.retention_discount_message}
                        onChange={(e) =>
                          setConfig((c) => ({
                            ...c,
                            retention_discount_message: e.target.value,
                          }))
                        }
                        rows={3}
                      />
                      <div className="rounded-md bg-muted p-3 text-xs">
                        <p className="mb-1 font-medium">{t.settings.preview}:</p>
                        <p className="whitespace-pre-wrap text-muted-foreground">
                          {preview(config.retention_discount_message)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
