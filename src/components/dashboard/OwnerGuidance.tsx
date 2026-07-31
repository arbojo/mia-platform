'use client'

import { useState } from 'react'
import type { CoachingRecommendation } from '@/lib/ai/recommendation-engine'

interface OwnerGuidanceProps {
  recommendation: CoachingRecommendation | null
}

export function OwnerGuidance({ recommendation }: OwnerGuidanceProps) {
  const [actionTaken, setActionTaken] = useState(false)
  const [dismissReason, setDismissReason] = useState('')
  const [showDismissInput, setShowDismissInput] = useState(false)

  if (!recommendation || actionTaken) {
    return (
      <div
        className="rounded-xl border p-5"
        style={{
          backgroundColor: 'var(--elevation-1)',
          borderColor: 'var(--atmosphere-border)',
        }}
      >
        <div
          className="text-sm"
          style={{ color: 'var(--atmosphere-text-secondary)' }}
        >
          {actionTaken
            ? 'Recomendación procesada. Vuelve pronto para la siguiente.'
            : 'Aún no tengo recomendaciones para ti. Sigue atendiendo clientes y las generaré.'}
        </div>
      </div>
    )
  }

  const handleAccept = async () => {
    const res = await fetch('/api/coaching/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'accept',
        recommendationId: recommendation.id,
      }),
    })
    if (res.ok) setActionTaken(true)
  }

  const handleDismiss = async () => {
    const res = await fetch('/api/coaching/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'dismiss',
        recommendationId: recommendation.id,
        reason: dismissReason || undefined,
      }),
    })
    if (res.ok) setActionTaken(true)
  }

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        backgroundColor: 'var(--elevation-1)',
        borderColor: 'var(--atmosphere-border)',
      }}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-xl">💡</span>
        <div className="min-w-0 flex-1">
          <h3
            className="mb-2 text-sm font-semibold"
            style={{ color: 'var(--atmosphere-text)' }}
          >
            Tengo una recomendación para ti
          </h3>

          <p
            className="mb-3 text-sm leading-relaxed"
            style={{ color: 'var(--atmosphere-text-secondary)' }}
          >
            {recommendation.observation}
          </p>

          <div
            className="mb-3 rounded-lg p-3 text-sm"
            style={{ backgroundColor: 'rgba(76, 175, 80, 0.08)' }}
          >
            <span style={{ color: 'var(--mia-green)' }}>
              {recommendation.suggested_improvement}
            </span>
          </div>

          <details className="group mb-3">
            <summary
              className="cursor-pointer text-xs font-medium"
              style={{ color: 'var(--atmosphere-text-secondary)' }}
            >
              Ver práctica recomendada
            </summary>
            <p
              className="mt-2 text-sm leading-relaxed"
              style={{ color: 'var(--atmosphere-text-secondary)' }}
            >
              {recommendation.recommended_practice}
            </p>
          </details>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAccept}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 hover:opacity-90"
              style={{
                backgroundColor: 'var(--atmosphere-accent)',
                color: 'white',
              }}
            >
              Aceptar
            </button>

            <button
              onClick={() => setShowDismissInput(true)}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200"
              style={{
                color: 'var(--atmosphere-text-secondary)',
                backgroundColor: 'transparent',
              }}
            >
              Descartar
            </button>
          </div>

          {showDismissInput && (
            <div className="mt-3 space-y-2">
              <input
                type="text"
                placeholder="¿Por qué descartas esta recomendación? (opcional)"
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{
                  backgroundColor: 'var(--elevation-1)',
                  borderColor: 'var(--atmosphere-border)',
                  color: 'var(--atmosphere-text)',
                }}
              />
              <button
                onClick={handleDismiss}
                className="rounded-lg px-4 py-2 text-sm font-medium"
                style={{
                  color: 'var(--mia-platinum)',
                  backgroundColor: 'rgba(244, 67, 54, 0.1)',
                }}
              >
                Confirmar descarte
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
