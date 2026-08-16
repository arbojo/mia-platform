import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SessionHistory } from '@/components/laboratorio/SessionHistory'

const sessions = [
  {
    id: 'session-1',
    mode: 'normal',
    title: 'chat directo',
    score: null,
    status: 'completed',
    created_at: '2026-08-16T12:00:00.000Z',
  },
  {
    id: 'session-2',
    mode: 'difficult',
    title: 'Escenario: objeciones',
    score: 8,
    status: 'completed',
    created_at: '2026-08-16T13:00:00.000Z',
  },
]

describe('SessionHistory', () => {
  it('muestra el estado vacio cuando no hay sesiones', () => {
    render(<SessionHistory sessions={[]} />)
    expect(screen.getByText('Aún no hay pruebas. ¡Comienza una!')).toBeInTheDocument()
  })

  it('renderiza las sesiones con su modo y fecha', () => {
    render(<SessionHistory sessions={sessions} />)
    expect(screen.getByText('chat directo')).toBeInTheDocument()
    expect(screen.getByText('Escenario: objeciones')).toBeInTheDocument()
    expect(screen.getByText('8/10')).toBeInTheDocument()
  })

  it('llama onDelete con el id de la sesion al borrar una tarjeta', () => {
    const onDelete = vi.fn()
    render(<SessionHistory sessions={sessions} onDelete={onDelete} />)

    const deleteButtons = screen.getAllByRole('button', { name: /eliminar sesión/i })
    fireEvent.click(deleteButtons[0])
    expect(onDelete).toHaveBeenCalledWith('session-1')
  })

  it('llama onClear desde el boton Limpiar historial', () => {
    const onClear = vi.fn()
    render(<SessionHistory sessions={sessions} onClear={onClear} />)

    fireEvent.click(screen.getByText('Limpiar historial'))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('no muestra acciones cuando no hay callbacks', () => {
    render(<SessionHistory sessions={sessions} />)
    expect(screen.queryByText('Limpiar historial')).not.toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: /eliminar sesión/i })).toHaveLength(0)
  })
})
