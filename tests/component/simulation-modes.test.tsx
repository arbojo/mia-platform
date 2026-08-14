import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  SimulationModes,
  simulationSystemMessages,
  type SimulationMode,
} from '@/components/laboratorio/SimulationModes'

describe('SimulationModes', () => {
  it('renderiza los 4 modos de simulacion', () => {
    render(<SimulationModes selected="normal" onSelect={() => {}} />)

    expect(screen.getByText('Cliente Normal')).toBeInTheDocument()
    expect(screen.getByText('Cliente Indeciso')).toBeInTheDocument()
    expect(screen.getByText('Cliente Complicado')).toBeInTheDocument()
    expect(screen.getByText('Cliente Exigente')).toBeInTheDocument()
  })

  it('llama onSelect con el id del modo seleccionado', () => {
    const onSelect = vi.fn()
    render(<SimulationModes selected="normal" onSelect={onSelect} />)

    fireEvent.click(screen.getByText('Cliente Complicado'))
    expect(onSelect).toHaveBeenCalledWith('difficult')
  })

  it('usa un contenedor flexible y botones que permiten wrapping para no recortar etiquetas', () => {
    const { container } = render(<SimulationModes selected="normal" onSelect={() => {}} />)

    const grid = container.querySelector('div.flex.flex-wrap')
    expect(grid).not.toBeNull()

    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBe(4)
    buttons.forEach((button) => {
      const className = button.getAttribute('class') ?? ''
      expect(className).toContain('whitespace-normal')
      expect(className).toContain('px-3')
      expect(className).toContain('py-1.5')
      expect(className).toContain('text-xs sm:text-sm')
    })
  })
})

describe('simulationSystemMessages', () => {
  it('define mensajes de sistema para los 4 modos', () => {
    const modes: SimulationMode[] = ['normal', 'indecisive', 'difficult', 'critical']
    for (const mode of modes) {
      expect(simulationSystemMessages[mode]).toBeTruthy()
      expect(simulationSystemMessages[mode].length).toBeGreaterThan(20)
    }
  })
})
