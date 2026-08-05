import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UsageBar } from '@/components/laboratorio/UsageBar'

describe('UsageBar', () => {
  it('renderiza tokens, costo, mensajes y modelo', () => {
    render(
      <UsageBar
        tokensInput={12000}
        tokensOutput={3400}
        cost={0.0123}
        messageCount={7}
        model="gpt-4o-mini"
      />
    )

    expect(screen.getByText(/12,000/)).toBeInTheDocument()
    expect(screen.getByText(/3,400/)).toBeInTheDocument()
    expect(screen.getByText(/\$0\.0123/)).toBeInTheDocument()
    expect(screen.getByText(/7/)).toBeInTheDocument()
    expect(screen.getByText(/gpt-4o-mini/)).toBeInTheDocument()
  })

  it('no renderiza boton exportar cuando no hay onExport', () => {
    render(
      <UsageBar
        tokensInput={0}
        tokensOutput={0}
        cost={0}
        messageCount={0}
        model="gpt-4o-mini"
      />
    )

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('llama onExport al hacer click', () => {
    const onExport = vi.fn()
    render(
      <UsageBar
        tokensInput={10}
        tokensOutput={5}
        cost={0.001}
        messageCount={1}
        model="gpt-4o-mini"
        onExport={onExport}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /exportar/i }))
    expect(onExport).toHaveBeenCalledTimes(1)
  })
})
