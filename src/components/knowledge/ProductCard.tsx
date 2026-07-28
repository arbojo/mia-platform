'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface ProductCardProps {
  product: {
    name: string
    price: number | null
    description: string | null
    benefits: string | null
    faq: Array<{ question: string; answer: string }>
    restrictions: string | null
    confidence: number
  }
  index: number
  onApprove: (index: number) => void
  onReject: (index: number) => void
  status?: 'approved' | 'rejected'
}

function ConfidenceField({
  label,
  value,
  confidence,
}: {
  label: string
  value: string | null
  confidence: number
}) {
  if (!value || value.trim().length === 0) {
    return (
      <div className="flex items-start gap-2 py-1.5">
        <span className="mt-0.5 text-sm text-amber-500">⚠</span>
        <div className="flex-1">
          <p className="text-sm text-zinc-500 italic">
            No encontré información sobre {label.toLowerCase()}.
          </p>
        </div>
      </div>
    )
  }

  if (confidence >= 70) {
    return (
      <div className="flex items-start gap-2 py-1.5">
        <span className="mt-0.5 text-sm text-emerald-500">✔</span>
        <div className="flex-1">
          <p className="text-sm text-zinc-900">
            <span className="font-medium">{label}:</span> {value}
          </p>
          <p className="text-xs text-zinc-400">Confianza: {confidence}%</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="mt-0.5 text-sm text-amber-500">⚠</span>
      <div className="flex-1">
        <p className="text-sm text-zinc-900">
          <span className="font-medium">{label}:</span> {value}
        </p>
        <p className="text-xs text-amber-600 italic">
          Creo que encontré esto, pero no estoy completamente segura. ¿Me lo puedes confirmar?
        </p>
        <p className="text-xs text-zinc-400">Confianza: {confidence}%</p>
      </div>
    </div>
  )
}

export function ProductCard({ product, index, onApprove, onReject, status }: ProductCardProps) {
  const [expanded, setExpanded] = useState(false)

  const approvedCount = [
    product.price !== null,
    product.description && product.description.trim().length > 0,
    product.benefits && product.benefits.trim().length > 0,
    product.restrictions && product.restrictions.trim().length > 0,
  ].filter(Boolean).length

  const totalFields = 4

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-zinc-900">{product.name}</h3>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
            {approvedCount}/{totalFields} campos
          </span>
        </div>
        <div className="flex items-center gap-2">
          {status === 'approved' ? (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
              ✓ Aprendido
            </span>
          ) : status === 'rejected' ? (
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-500">
              Omitido
            </span>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setExpanded(!expanded)}
                className="text-zinc-500 hover:text-zinc-700"
              >
                {expanded ? 'Ocultar' : 'Ver detalles'}
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => onApprove(index)}
              >
                ✓ Enséñame esto
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReject(index)}
              >
                ✕ Omitir
              </Button>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-1 divide-y divide-zinc-50">
          <ConfidenceField
            label="Precio"
            value={product.price !== null ? `$${product.price}` : null}
            confidence={product.price !== null ? 95 : 0}
          />
          <ConfidenceField
            label="Descripción"
            value={product.description}
            confidence={product.description ? 90 : 0}
          />
          <ConfidenceField
            label="Beneficios"
            value={product.benefits}
            confidence={product.benefits ? 85 : 0}
          />
          <ConfidenceField
            label="Restricciones"
            value={product.restrictions}
            confidence={product.restrictions ? 80 : 0}
          />

          {product.faq.length > 0 && (
            <div className="pt-3">
              <p className="mb-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                Preguntas que sé responder
              </p>
              {product.faq.map((faq, i) => (
                <div key={i} className="py-1.5">
                  <p className="text-sm font-medium text-zinc-800">P: {faq.question}</p>
                  <p className="text-sm text-zinc-600">R: {faq.answer}</p>
                </div>
              ))}
            </div>
          )}

          {product.confidence < 70 && (
            <div className="mt-3 rounded-lg bg-amber-50 p-3">
              <p className="text-sm text-amber-800">
                No estoy completamente segura de la información de este producto.
                ¿Podrías revisarme si está correcto?
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
