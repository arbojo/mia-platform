import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SuccessPop } from '@/components/ui/success-pop'

describe('SuccessPop', () => {
  it('muestra el mensaje de confirmación', () => {
    render(<SuccessPop message="Conocimiento guardado" />)
    expect(screen.getByText('Conocimiento guardado')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })

  it('muestra el submensaje opcional', () => {
    render(<SuccessPop message="Guardado" submessage="MIA ya puede responder esto" />)
    expect(screen.getByText('MIA ya puede responder esto')).toBeInTheDocument()
  })

  it('aplica la animación elastic pop', () => {
    const { container } = render(<SuccessPop message="Guardado" />)
    expect(container.querySelector('.animate-elastic-pop')).not.toBeNull()
  })
})
