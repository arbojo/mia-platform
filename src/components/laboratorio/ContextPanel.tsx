'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface ContextPanelProps {
  brand: {
    business_name: string
    elevator_pitch?: string
    target_customers?: string
    differentiators?: string
  } | null
  products: Array<{ id: string; name: string; price: number | null }>
  rules: Array<{ id: string; category: string; content: string }>
  knowledge: Array<{ id: string; question: string; answer: string }>
  instructions: Array<{ id: string; instruction: string }>
  assistantName: string
  personality: Record<string, number>
  communicationStyle: string
  systemPrompt: string
}

export function ContextPanel({
  brand,
  products,
  rules,
  knowledge,
  instructions,
  assistantName,
  personality,
  communicationStyle,
  systemPrompt,
}: ContextPanelProps) {
  const [showPrompt, setShowPrompt] = useState(false)
  const [view, setView] = useState<'human' | 'technical'>('human')

  const personalityLabels: string[] = []
  if ((personality.warmth ?? 70) > 70) personalityLabels.push('Cálida')
  if ((personality.formality ?? 40) > 70) personalityLabels.push('Formal')
  if ((personality.humor ?? 30) > 70) personalityLabels.push('Con buen humor')
  if ((personality.sales_aggressiveness ?? 50) > 70) personalityLabels.push('Proactiva')
  if (personalityLabels.length === 0) personalityLabels.push('Equilibrada')

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">
          📋 Lo que {assistantName} sabe
        </h3>
        <div className="flex gap-1">
          <Button
            variant={view === 'human' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setView('human')}
          >
            Cliente
          </Button>
          <Button
            variant={view === 'technical' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setView('technical')}
          >
            Técnico
          </Button>
        </div>
      </div>

      {view === 'human' ? (
        <div className="space-y-4">
          {brand && (
            <section>
              <p className="font-medium text-gray-700 mb-1">Identidad</p>
              <p className="text-gray-600">{brand.business_name}</p>
              {brand.elevator_pitch && (
                <p className="text-gray-500 text-xs mt-1 italic">
                  &ldquo;{brand.elevator_pitch}&rdquo;
                </p>
              )}
            </section>
          )}

          <section>
            <p className="font-medium text-gray-700 mb-1">
              Productos <Badge variant="secondary">{products.length}</Badge>
            </p>
            <ul className="space-y-1">
              {products.slice(0, 5).map((p) => (
                <li key={p.id} className="text-gray-600">
                  {p.name} {p.price ? `— $${p.price}` : ''}
                </li>
              ))}
              {products.length > 5 && (
                <li className="text-gray-400 text-xs">
                  +{products.length - 5} más
                </li>
              )}
            </ul>
          </section>

          <section>
            <p className="font-medium text-gray-700 mb-1">
              Reglas <Badge variant="secondary">{rules.length}</Badge>
            </p>
            <ul className="space-y-1">
              {rules.slice(0, 5).map((r) => (
                <li key={r.id} className="text-gray-600">
                  <span className="text-xs text-gray-400">[{r.category}]</span>{' '}
                  {r.content.length > 60
                    ? r.content.slice(0, 60) + '...'
                    : r.content}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <p className="font-medium text-gray-700 mb-1">
              Conocimiento <Badge variant="secondary">{knowledge.length}</Badge>
            </p>
            <ul className="space-y-1">
              {knowledge.slice(0, 5).map((k) => (
                <li key={k.id} className="text-gray-600">
                  {k.question.length > 50
                    ? k.question.slice(0, 50) + '...'
                    : k.question}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <p className="font-medium text-gray-700 mb-1">
              Instrucciones <Badge variant="secondary">{instructions.length}</Badge>
            </p>
            <ul className="space-y-1">
              {instructions.map((i) => (
                <li key={i.id} className="text-gray-600">
                  {i.instruction.length > 60
                    ? i.instruction.slice(0, 60) + '...'
                    : i.instruction}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <p className="font-medium text-gray-700 mb-1">Personalidad</p>
            <div className="flex flex-wrap gap-1">
              {personalityLabels.map((label) => (
                <Badge key={label} variant="outline" className="text-xs">
                  {label}
                </Badge>
              ))}
              <Badge variant="outline" className="text-xs capitalize">
                {communicationStyle}
              </Badge>
            </div>
          </section>
        </div>
      ) : (
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start mb-2"
            onClick={() => setShowPrompt(!showPrompt)}
          >
            {showPrompt ? 'Ocultar prompt' : 'Ver prompt generado'}
          </Button>
          {showPrompt && (
            <pre className="p-3 bg-gray-900 text-gray-100 rounded-lg text-xs overflow-auto max-h-96 whitespace-pre-wrap font-mono">
              {systemPrompt}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
