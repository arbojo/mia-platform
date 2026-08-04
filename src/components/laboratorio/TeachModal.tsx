'use client'

import { useState } from 'react'
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

export function TeachModal({ suggestions, businessId, assistantId, conversationId, onClose, onTaught }: TeachModalProps) {
  const [items, setItems] = useState(
    suggestions.map((s) => ({
      type: 'knowledge' as 'knowledge' | 'rule' | 'instruction',
      question: '',
      answer: s,
      category: 'restrictions',
    }))
  )
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleUpdate = (index: number, field: string, value: string) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    )
  }

  const handleSave = async () => {
    setLoading(true)
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
      const data = await res.json()
      if (data.count > 0) {
        setSaved(true)
        onTaught()
      }
    } catch (error) {
      console.error('Teach error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (saved) {
    return (
      <div className="p-6 text-center space-y-4">
        <p className="text-2xl">✨</p>
        <p className="font-medium text-gray-900">¡MIA ya sabe esto!</p>
        <p className="text-sm text-gray-500">
          La próxima vez que un cliente pregunte algo similar, MIA responderá
          con esta información.
        </p>
        <Button onClick={onClose} className="bg-olive-600 hover:bg-olive-700">
          Cerrar
        </Button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900">✨ Enseñarle a MIA</h3>
        <p className="text-sm text-gray-500">
          Revisa y edita lo que MIA debe aprender:
        </p>
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto">
        {items.map((item, index) => (
          <div key={index} className="p-3 border rounded-lg space-y-2">
            <div className="flex gap-2">
              <Button
                variant={item.type === 'knowledge' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleUpdate(index, 'type', 'knowledge')}
              >
                Conocimiento
              </Button>
              <Button
                variant={item.type === 'rule' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleUpdate(index, 'type', 'rule')}
              >
                Regla
              </Button>
              <Button
                variant={item.type === 'instruction' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleUpdate(index, 'type', 'instruction')}
              >
                Instrucción
              </Button>
            </div>

            {item.type === 'knowledge' && (
              <div className="space-y-2">
                <Input
                  placeholder="¿Qué pregunta debe poder responder?"
                  value={item.question}
                  onChange={(e) => handleUpdate(index, 'question', e.target.value)}
                />
              </div>
            )}

            {item.type === 'rule' && (
              <select
                className="w-full p-2 border rounded text-sm"
                value={item.category}
                onChange={(e) => handleUpdate(index, 'category', e.target.value)}
              >
                <option value="zones">Zonas</option>
                <option value="payment">Pago</option>
                <option value="schedule">Horarios</option>
                <option value="promotions">Promociones</option>
                <option value="restrictions">Restricciones</option>
                <option value="escalation">Escalación</option>
              </select>
            )}

            <Textarea
              placeholder="¿Qué debe responder?"
              value={item.answer}
              onChange={(e) => handleUpdate(index, 'answer', e.target.value)}
              rows={2}
            />
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onClose} className="flex-1">
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={loading}
          className="flex-1 bg-olive-600 hover:bg-olive-700"
        >
          {loading ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </div>
  )
}
