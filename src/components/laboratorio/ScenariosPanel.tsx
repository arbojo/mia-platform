'use client'

import { Card, CardContent } from '@/components/ui/card'

export interface Scenario {
  id: string
  name: string
  emoji: string
  customerMessage: string
  focus: string
}

const scenarios: Scenario[] = [
  {
    id: 'price',
    name: 'Precio',
    emoji: '💰',
    customerMessage: '¿Cuánto cuesta?',
    focus: 'Conocimiento de productos y propuesta de valor',
  },
  {
    id: 'shipping',
    name: 'Envío',
    emoji: '🚚',
    customerMessage: '¿Hacen envíos? ¿A cuánto está el envío?',
    focus: 'Reglas de negocio y logística',
  },
  {
    id: 'warranty',
    name: 'Garantía',
    emoji: '🛡️',
    customerMessage: '¿Tiene garantía? ¿Qué cubre?',
    focus: 'Conocimiento de producto y generación de confianza',
  },
  {
    id: 'comparison',
    name: 'Comparación',
    emoji: '⚖️',
    customerMessage: '¿Por qué debería comprar aquí y no en la competencia?',
    focus: 'Diferenciadores y técnicas de venta',
  },
  {
    id: 'objection',
    name: 'Objeción',
    emoji: '🤔',
    customerMessage: 'Me parece caro. ¿No hay descuento?',
    focus: 'Manejo de objeciones y valor percibido',
  },
  {
    id: 'urgency',
    name: 'Urgencia',
    emoji: '⏰',
    customerMessage: 'Lo necesito para hoy. ¿Se puede?',
    focus: 'Horarios, reglas y solución de problemas',
  },
  {
    id: 'unsure',
    name: 'No sé qué necesito',
    emoji: '🤷',
    customerMessage: 'No estoy seguro de qué necesito. ¿Me pueden ayudar?',
    focus: 'Venta consultiva y descubrimiento de necesidades',
  },
]

interface ScenariosPanelProps {
  onSelect: (scenario: Scenario) => void
  activeScenarioId?: string
}

export function ScenariosPanel({ onSelect, activeScenarioId }: ScenariosPanelProps) {
  return (
    <Card className="border-brand-100">
      <CardContent className="pt-4">
        <h3 className="font-semibold text-gray-900 mb-3">Escenarios de prueba</h3>
        <p className="text-xs text-gray-500 mb-3">
          Selecciona un escenario para simular una conversación
        </p>
        <div className="space-y-2">
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => onSelect(scenario)}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                activeScenarioId === scenario.id
                  ? 'border-brand-600 bg-brand-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>{scenario.emoji}</span>
                <span className="font-medium text-sm">{scenario.name}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1 ml-6">{scenario.focus}</p>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function getScenarioById(id: string): Scenario | undefined {
  return scenarios.find((s) => s.id === id)
}
