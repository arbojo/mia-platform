import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SignalIndicator } from '@/components/signals/SignalIndicator'

describe('SignalIndicator', () => {
  it('renderiza el estado tranquila sin badge', () => {
    render(<SignalIndicator state="tranquila" />)

    expect(screen.getByTitle('MIA está tranquila')).toBeInTheDocument()
    expect(document.querySelector('span')).not.toBeInTheDocument()
  })

  it('renderiza badge en estado atencion', () => {
    render(<SignalIndicator state="atencion" />)

    expect(screen.getByTitle('MIA necesita tu atención')).toBeInTheDocument()
    expect(document.querySelector('span')).toBeInTheDocument()
  })

  it('llama onClick al hacer click', () => {
    const onClick = vi.fn()
    render(<SignalIndicator state="decision" onClick={onClick} />)

    fireEvent.click(screen.getByTitle('MIA necesita tu decisión'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
