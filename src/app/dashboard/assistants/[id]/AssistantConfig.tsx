'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Send, Power, PowerOff, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

const STATUS_CONFIG = {
  draft: { label: 'Borrador', color: 'text-gray-500', bg: 'bg-gray-100', icon: XCircle },
  training: { label: 'En entrenamiento', color: 'text-amber-600', bg: 'bg-amber-50', icon: AlertTriangle },
  ready: { label: 'Lista', color: 'text-blue-600', bg: 'bg-blue-50', icon: CheckCircle2 },
  active: { label: 'Activa', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: Power },
  inactive: { label: 'Inactiva', color: 'text-red-600', bg: 'bg-red-50', icon: PowerOff },
} as const

const STYLE_OPTIONS = [
  { value: 'formal', label: 'Formal' },
  { value: 'casual', label: 'Casual' },
  { value: 'warm', label: 'Cálido' },
  { value: 'direct', label: 'Directo' },
] as const

interface AssistantData {
  id: string
  name: string
  personality: Record<string, number>
  communication_style: string
  status: string
}

interface Readiness {
  hasBrand: boolean
  hasProducts: boolean
  hasRules: boolean
  hasKnowledge: boolean
  hasTraining: boolean
}

export function AssistantConfig({ assistant, readiness }: { assistant: AssistantData; readiness: Readiness }) {
  const router = useRouter()
  const [name, setName] = useState(assistant.name)
  const [style, setStyle] = useState(assistant.communication_style)
  const [personality, setPersonality] = useState({
    warmth: assistant.personality?.warmth ?? 70,
    formality: assistant.personality?.formality ?? 40,
    humor: assistant.personality?.humor ?? 30,
    sales_aggressiveness: assistant.personality?.sales_aggressiveness ?? 50,
  })
  const [status, setStatus] = useState(assistant.status)
  const [saving, setSaving] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentStatus = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.draft

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/assistants/${assistant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, communication_style: style, personality }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Error al guardar')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeploy() {
    setDeploying(true)
    setError(null)
    try {
      const res = await fetch(`/api/assistants/${assistant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Error al publicar')
      }
      setStatus('active')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al publicar')
    } finally {
      setDeploying(false)
    }
  }

  async function handleDeactivate() {
    setDeploying(true)
    setError(null)
    try {
      const res = await fetch(`/api/assistants/${assistant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'inactive' }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Error al desactivar')
      }
      setStatus('inactive')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al desactivar')
    } finally {
      setDeploying(false)
    }
  }

  async function handleMarkReady() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/assistants/${assistant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ready' }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Error al marcar como lista')
      }
      setStatus('ready')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al marcar como lista')
    } finally {
      setSaving(false)
    }
  }

  const canDeploy = readiness.hasProducts && readiness.hasRules && readiness.hasKnowledge && readiness.hasTraining
  const missingItems = []
  if (!readiness.hasProducts) missingItems.push('Productos')
  if (!readiness.hasRules) missingItems.push('Reglas de venta')
  if (!readiness.hasKnowledge) missingItems.push('Conocimiento')
  if (!readiness.hasTraining) missingItems.push('Entrenamiento (correcciones)')

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/assistants" className="p-2 hover:opacity-60 transition-opacity">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
          {assistant.name}
        </h1>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${currentStatus.bg} ${currentStatus.color}`}>
          <currentStatus.icon className="h-3.5 w-3.5" />
          {currentStatus.label}
        </span>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl p-6 space-y-6" style={{ backgroundColor: 'var(--elevation-2)' }}>
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--atmosphere-text)' }}>
            Nombre del asistente
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border bg-transparent px-4 py-2.5 text-sm outline-none transition-all duration-200 focus:ring-2"
            style={{ borderColor: 'var(--elevation-3, rgba(0,0,0,0.08))', color: 'var(--atmosphere-text)' }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--atmosphere-text)' }}>
            Estilo de comunicación
          </label>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="w-full rounded-xl border bg-transparent px-4 py-2.5 text-sm outline-none transition-all duration-200 focus:ring-2"
            style={{ borderColor: 'var(--elevation-3, rgba(0,0,0,0.08))', color: 'var(--atmosphere-text)' }}
          >
            {STYLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-medium" style={{ color: 'var(--atmosphere-text)' }}>
            Personalidad
          </label>

          <SliderField label="Cercanía" value={personality.warmth} onChange={(v) => setPersonality({ ...personality, warmth: v })} left="Profesional" right="Cercana" />
          <SliderField label="Formalidad" value={personality.formality} onChange={(v) => setPersonality({ ...personality, formality: v })} left="Casual" right="Formal" />
          <SliderField label="Humor" value={personality.humor} onChange={(v) => setPersonality({ ...personality, humor: v })} left="Serio" right="Divertido" />
          <SliderField label="Agresividad comercial" value={personality.sales_aggressiveness} onChange={(v) => setPersonality({ ...personality, sales_aggressiveness: v })} left="Consultivo" right="Proactivo" />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="bg-olive-600 hover:bg-olive-700">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </div>

      <div className="rounded-xl p-6 space-y-4" style={{ backgroundColor: 'var(--elevation-2)' }}>
        <h2 className="text-lg font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
          Ciclo de vida
        </h2>

        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
          <span>Borrador</span>
          <span className="opacity-40">→</span>
          <span>Entrenamiento</span>
          <span className="opacity-40">→</span>
          <span>Lista</span>
          <span className="opacity-40">→</span>
          <span className="font-medium text-emerald-600">Activa</span>
          <span className="opacity-40">→</span>
          <span className="text-red-600">Inactiva</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
          <div className="flex items-center gap-2">
            {readiness.hasBrand ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-400" />}
            Información del negocio
          </div>
          <div className="flex items-center gap-2">
            {readiness.hasProducts ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-400" />}
            Productos
          </div>
          <div className="flex items-center gap-2">
            {readiness.hasRules ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-400" />}
            Reglas de venta
          </div>
          <div className="flex items-center gap-2">
            {readiness.hasKnowledge ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-400" />}
            Conocimiento
          </div>
          <div className="flex items-center gap-2">
            {readiness.hasTraining ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-400" />}
            Entrenamiento
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          {status === 'draft' || status === 'training' ? (
            <Button onClick={handleMarkReady} disabled={saving} variant="outline">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Marcar como lista
            </Button>
          ) : null}

          {status === 'ready' || status === 'inactive' ? (
            <div className="space-y-2 w-full">
              {!canDeploy && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
                  Faltan: {missingItems.join(', ')}. Completa estos requisitos antes de activar.
                </div>
              )}
              <Button
                onClick={handleDeploy}
                disabled={deploying || !canDeploy}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40"
              >
                <Send className="h-4 w-4 mr-2" />
                {deploying ? 'Publicando...' : 'Publicar asistente'}
              </Button>
            </div>
          ) : null}

          {status === 'active' ? (
            <Button onClick={handleDeactivate} disabled={deploying} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50">
              <PowerOff className="h-4 w-4 mr-2" />
              Desactivar
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex gap-2">
        <Link href={`/dashboard/assistants/${assistant.id}/training`}>
          <Button variant="outline">Entrenar</Button>
        </Link>
        <Link href="/dashboard/catalog">
          <Button variant="outline">Catálogo</Button>
        </Link>
        <Link href={`/dashboard/assistants/${assistant.id}/rules`}>
          <Button variant="outline">Reglas</Button>
        </Link>
      </div>
    </div>
  )
}

function SliderField({
  label,
  value,
  onChange,
  left,
  right,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  left: string
  right: string
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--atmosphere-text-secondary)' }}>
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-olive-600"
      />
      <div className="flex justify-between text-[10px]" style={{ color: 'var(--atmosphere-text-secondary)' }}>
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  )
}
