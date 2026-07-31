'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DollarSign, Target, CheckCircle, XCircle, Clock } from 'lucide-react'

type Outcome = 'pending' | 'interested' | 'not_interested' | 'sold' | 'needs_follow_up'

const outcomeOptions: Array<{ value: Outcome; label: string; color: string; icon: React.ReactNode }> = [
  { value: 'interested', label: 'Interesado', color: 'var(--mia-blue)', icon: <Target className="h-3.5 w-3.5" /> },
  { value: 'sold', label: 'Vendido', color: 'var(--mia-green)', icon: <CheckCircle className="h-3.5 w-3.5" /> },
  { value: 'not_interested', label: 'No interesado', color: 'var(--mia-platinum)', icon: <XCircle className="h-3.5 w-3.5" /> },
  { value: 'needs_follow_up', label: 'Seguimiento', color: 'var(--mia-gold)', icon: <Clock className="h-3.5 w-3.5" /> },
]

interface ConversationOutcomeSelectorProps {
  conversationId: string
  currentOutcome: string | null
  currentDealValue: number | null
  currentPotentialValue: number | null
}

export function ConversationOutcomeSelector({
  conversationId,
  currentOutcome,
  currentDealValue,
  currentPotentialValue,
}: ConversationOutcomeSelectorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome | null>(currentOutcome as Outcome | null)
  const [dealValue, setDealValue] = useState<string>(currentDealValue?.toString() ?? '')
  const [potentialValue, setPotentialValue] = useState<string>(currentPotentialValue?.toString() ?? '')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(outcome: Outcome) {
    setError(null)
    setSelectedOutcome(outcome)

    const body: Record<string, unknown> = { outcome }
    if (outcome === 'sold') body.deal_value = parseFloat(dealValue) || null
    if (outcome === 'interested' || outcome === 'needs_follow_up') {
      body.potential_value = parseFloat(potentialValue) || null
    }

    try {
      const res = await fetch(`/api/conversations/${conversationId}/outcome`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Error al guardar')
        setSelectedOutcome(currentOutcome as Outcome | null)
        return
      }

      startTransition(() => router.refresh())
    } catch {
      setError('Error de conexión')
      setSelectedOutcome(currentOutcome as Outcome | null)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {outcomeOptions.map((opt) => {
          const isActive = selectedOutcome === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              disabled={isPending}
              onClick={() => handleSubmit(opt.value)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200"
              style={{
                backgroundColor: isActive ? `${opt.color}20` : 'var(--elevation-2)',
                color: isActive ? opt.color : 'var(--atmosphere-text-secondary)',
                border: `1px solid ${isActive ? opt.color : 'transparent'}`,
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {opt.icon}
              {opt.label}
            </button>
          )
        })}
      </div>

      {selectedOutcome === 'sold' && (
        <div className="mt-3">
          <label
            className="mb-1 block text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.6 }}
          >
            <DollarSign className="mr-1 inline h-3 w-3" />
            Monto de la venta
          </label>
          <div className="relative">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
              style={{ color: 'var(--atmosphere-text-secondary)' }}
            >
              $
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={dealValue}
              onChange={(e) => setDealValue(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border py-2 pl-8 pr-4 text-sm outline-none transition-all duration-200"
              style={{
                backgroundColor: 'var(--elevation-1)',
                borderColor: 'var(--atmosphere-border)',
                color: 'var(--atmosphere-text)',
              }}
            />
          </div>
        </div>
      )}

      {(selectedOutcome === 'interested' || selectedOutcome === 'needs_follow_up') && (
        <div className="mt-3">
          <label
            className="mb-1 block text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.6 }}
          >
            <DollarSign className="mr-1 inline h-3 w-3" />
            Valor potencial estimado
          </label>
          <div className="relative">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
              style={{ color: 'var(--atmosphere-text-secondary)' }}
            >
              $
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={potentialValue}
              onChange={(e) => setPotentialValue(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border py-2 pl-8 pr-4 text-sm outline-none transition-all duration-200"
              style={{
                backgroundColor: 'var(--elevation-1)',
                borderColor: 'var(--atmosphere-border)',
                color: 'var(--atmosphere-text)',
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <p
          className="mt-2 text-xs"
          style={{ color: 'var(--mia-platinum)' }}
        >
          {error}
        </p>
      )}
    </div>
  )
}
