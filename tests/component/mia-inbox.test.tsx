import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MIAInbox } from '@/components/signals/MIAInbox'
import { ContextMenuProvider } from '@/components/ui/context-menu'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const signalFixture = {
  id: 'sig-1',
  type: 'SALES',
  priority: 'atencion',
  title: 'Nuevo pedido confirmado',
  message: 'david ramirez confirmó un pedido de Clean Nails',
  source: 'sales-closing',
  status: 'pending',
  action_available: 'open_conversation',
  action_payload: { conversation_id: 'conv-1' },
  created_at: '2026-08-08T17:43:33.000Z',
}

function renderInbox() {
  return render(
    <ContextMenuProvider>
      <MIAInbox open onClose={() => {}} />
    </ContextMenuProvider>
  )
}

describe('MIAInbox context menu', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it('abre el menú contextual al hacer clic derecho en una señal', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ signals: [signalFixture] }),
      })
    )

    renderInbox()

    await screen.findByText('Nuevo pedido confirmado')
    const card = screen.getByText('Nuevo pedido confirmado').closest('div[class*="rounded-xl"]')!
    fireEvent.contextMenu(card)

    expect(await screen.findByRole('menu')).toBeInTheDocument()
    expect(screen.getByText('Abrir conversación')).toBeInTheDocument()
    expect(screen.getByText('Marcar como resuelta')).toBeInTheDocument()
  })

  it('resuelve la señal desde el menú contextual', async () => {
    const patch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) =>
        url.startsWith('/api/signals') && init?.method === 'PATCH' ? patch() : Promise.resolve({ ok: true, json: async () => ({ signals: [signalFixture] }) })
      )
    )

    renderInbox()

    await screen.findByText('Nuevo pedido confirmado')
    const card = screen.getByText('Nuevo pedido confirmado').closest('div[class*="rounded-xl"]')!
    fireEvent.contextMenu(card)
    fireEvent.click(await screen.findByText('Marcar como resuelta'))

    expect(patch).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(screen.queryByText('Nuevo pedido confirmado')).not.toBeInTheDocument()
    })
  })

  it('navega a la conversación desde el menú contextual', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ signals: [signalFixture] }),
      })
    )

    renderInbox()

    await screen.findByText('Nuevo pedido confirmado')
    const card = screen.getByText('Nuevo pedido confirmado').closest('div[class*="rounded-xl"]')!
    fireEvent.contextMenu(card)
    fireEvent.click(await screen.findByText('Abrir conversación'))

    expect(mockPush).toHaveBeenCalledWith('/dashboard/conversations/conv-1')
  })

  it('no renderiza el botón flotante redundante por señal', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ signals: [signalFixture] }),
      })
    )

    renderInbox()

    await screen.findByText('Nuevo pedido confirmado')
    expect(screen.queryByLabelText('Marcar como resuelta')).not.toBeInTheDocument()
  })
})
