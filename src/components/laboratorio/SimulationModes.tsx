'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const modes = [
  {
    id: 'normal',
    label: 'Cliente Normal',
    icon: '🟢',
    description: 'Preguntas directas, interés genuino',
  },
  {
    id: 'indecisive',
    label: 'Cliente Indeciso',
    icon: '🟡',
    description: 'Duda, compara, pide descuento',
  },
  {
    id: 'difficult',
    label: 'Cliente Complicado',
    icon: '🔴',
    description: 'Cuestiona calidad, compara con competencia',
  },
  {
    id: 'critical',
    label: 'Cliente Exigente',
    icon: '💀',
    description: 'Exigente, busca errores, presiona al máximo',
  },
] as const

export type SimulationMode = (typeof modes)[number]['id']

interface SimulationModesProps {
  selected: SimulationMode
  onSelect: (mode: SimulationMode) => void
}

export function SimulationModes({ selected, onSelect }: SimulationModesProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">Modo de prueba</p>
      <div className="grid grid-cols-2 gap-2">
        {modes.map((mode) => (
          <Button
            key={mode.id}
            variant={selected === mode.id ? 'default' : 'outline'}
            className={cn(
              'justify-start h-auto py-2 px-3 text-left',
              selected === mode.id && 'bg-violet-600 hover:bg-violet-700'
            )}
            onClick={() => onSelect(mode.id)}
          >
            <div>
              <span className="mr-1">{mode.icon}</span>
              <span className="text-sm">{mode.label}</span>
            </div>
          </Button>
        ))}
      </div>
    </div>
  )
}

export const simulationSystemMessages: Record<SimulationMode, string> = {
  normal: 'Actúa como un cliente interesado en comprar. Haz preguntas directas sobre productos, precios y disponibilidad.',
  indecisive: 'Actúa como un cliente que no está seguro. Duda, compara precios, pregunta "¿y si no me gusta?", pide descuento, se va y vuelve.',
  difficult: 'Actúa como un cliente difícil. Cuestiona la calidad, compara con la competencia, pide cosas que no existen, se queja del precio.',
  critical: 'Actúa como un cliente muy exigente y crítico. Busca cada detalle, cuestiona todo, presiona para obtener más de lo que se ofrece.',
}
