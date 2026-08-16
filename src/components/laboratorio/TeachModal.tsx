'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface TeachModalProps {
  suggestions: string[]
  businessId: string
  assistantId: string
  conversationId?: string
  onClose: () => void
  onTaught: () => void
}

type ItemType = 'knowledge' | 'rule' | 'instruction'

const KNOWLEDGE_CATEGORIES = ['business_info', 'faq', 'objection', 'process', 'tip'] as const
const RULE_CATEGORIES = ['zones', 'payment', 'schedule', 'promotions', 'restrictions', 'escalation'] as const

const TYPE_HINTS: Record<ItemType, string> = {
  knowledge:
    'Pregunta y respuesta: MIA la usará cuando un cliente pregunte algo similar. Requiere una pregunta. Ideal para datos concretos del negocio.',
  rule:
    'Regla de venta que MIA siempre respeta (zonas, pagos, horarios, restricciones...). No necesita pregunta.',
  instruction:
    'Comportamiento que MIA debe seguir en la conversación, sin estar atado a una pregunta. Ideal para consejos conductuales como variar el cierre o la empatía.',
}

interface TeachItem {
  type: ItemType
  question: string
  answer: string
  category: string
}

export function TeachModal({ suggestions, businessId, assistantId, conversationId, onClose, onTaught }: TeachModalProps) {
  const [items, setItems] = useState<TeachItem[]>(
    suggestions.map((s) => ({
      type: 'knowledge' as ItemType,
      question: '',
      answer: s,
      category: 'faq',
    }))
  )
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ saved: number; total: number; skipped: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const updateItem = (index: number, patch: Partial<TeachItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
    setError(null)
  }

  const discardItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
    setError(null)
  }

  const missingQuestions = items
    .map((item, index) => (item.type === 'knowledge' && !item.question.trim() ? index : -1))
    .filter((i) => i >= 0)

  const handleSave = async () => {
    if (missingQuestions.length > 0) {
      setError('Los conocimientos sin pregunta no se guardan. Escribe una pregunta o cámbialos a Regla/Instrucción.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/laboratorio/teach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          assistant_id: assistantId,
          conversation_id: conversationId,
          items,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? 'No se pudo guardar. Inténtalo de nuevo.')
        return
      }

      const data = await res.json()
      const saved = data.count ?? 0
      if (saved > 0) {
        const omitted = items.length - saved
        setFeedback({
          saved,
          total: items.length,
          skipped: omitted > 0 ? [`Se omitieron ${omitted} item(s) que el servidor no pudo guardar.`] : [],
        })
        onTaught()
      } else {
        setError('No se guardó nada: revisa que cada conocimiento tenga una pregunta o usa Regla/Instrucción.')
      }
    } catch (err) {
      console.error('Teach error:', err)
      setError('Error de red al guardar. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (feedback && feedback.saved > 0) {
    return (
      <div className="animate-elastic-pop p-6 text-center space-y-4">
        <p className="text-2xl">✨</p>
        <p className="font-medium text-gray-900">
          ¡MIA ya sabe esto! Se guardaron {feedback.saved} de {feedback.total}.
        </p>
        <p className="text-sm text-gray-500">
          La próxima vez que un cliente pregunte algo similar, MIA responderá con esta información.
        </p>
        {feedback.skipped.length > 0 && (
          <ul className="text-sm text-amber-600 list-disc list-inside text-left">
            {feedback.skipped.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        )}
        <Button onClick={onClose} className="bg-brand-600 hover:bg-brand-700">
          Cerrar
        </Button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="p-6 text-center space-y-4">
        <p className="text-2xl">🗑️</p>
        <p className="font-medium text-gray-900">Descartaste todas las sugerencias</p>
        <p className="text-sm text-gray-500">No se guardó nada. MIA seguirá aprendiendo con las próximas sesiones.</p>
        <Button variant="outline" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900">✨ Enseñarle a MIA</h3>
        <p className="text-sm text-gray-500">Revisa y edita lo que MIA debe aprender:</p>
      </div>

      <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">
        <span className="font-medium">Consejo:</span> las sugerencias de comportamiento (variar el cierre, empatía,
        manejo de objeciones) funcionan mejor como <span className="font-medium">Instrucción</span> o{' '}
        <span className="font-medium">Regla</span>, no como Conocimiento.
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto">
        {items.map((item, index) => {
          const invalid = item.type === 'knowledge' && !item.question.trim() && !error
          const categories = item.type === 'knowledge' ? KNOWLEDGE_CATEGORIES : RULE_CATEGORIES
          return (
            <div
              key={index}
              className={`p-3 border rounded-lg space-y-2 ${invalid ? 'border-red-400 bg-red-50' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex gap-2 flex-wrap">
                  {(Object.keys(TYPE_HINTS) as ItemType[]).map((t) => (
                    <Button
                      key={t}
                      type="button"
                      variant={item.type === t ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateItem(index, { type: t, category: t === 'knowledge' ? 'faq' : 'restrictions' })}
                    >
                      {t === 'knowledge' ? 'Conocimiento' : t === 'rule' ? 'Regla' : 'Instrucción'}
                    </Button>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => discardItem(index)}
                  aria-label="Descartar esta sugerencia"
                  className="text-gray-400 hover:text-red-600"
                >
                  <X className="size-4" />
                  Desechar
                </Button>
              </div>
              <p className="text-xs text-gray-500">{TYPE_HINTS[item.type]}</p>

              {item.type === 'knowledge' && (
                <div className="space-y-2">
                  <Input
                    placeholder="¿Qué pregunta debe poder responder?"
                    value={item.question}
                    onChange={(e) => updateItem(index, { question: e.target.value })}
                  />
                  {!item.question.trim() && (
                    <p className="text-xs text-red-600">Falta la pregunta: los conocimientos sin pregunta no se guardan.</p>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                {item.type !== 'instruction' && (
                  <select
                    className="w-1/3 p-2 border rounded text-sm"
                    value={item.category}
                    onChange={(e) => updateItem(index, { category: e.target.value })}
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
                <Textarea
                  placeholder="¿Qué debe responder?"
                  value={item.answer}
                  onChange={(e) => updateItem(index, { answer: e.target.value })}
                  rows={2}
                  className={item.type !== 'instruction' ? 'flex-1' : 'w-full'}
                />
              </div>
            </div>
          )
        })}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onClose} className="flex-1">
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={loading}
          className="flex-1 bg-brand-600 hover:bg-brand-700"
        >
          {loading ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </div>
  )
}
