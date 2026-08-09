import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChatWindow } from '@/components/chat/ChatWindow'

function streamResponse(overrides?: Partial<{
  salesIntent: string
  conversationId: string | null
  bodyText: string
}>) {
  const { salesIntent = '1', conversationId = 'conv-1', bodyText = '¡Claro!' } =
    overrides ?? {}
  const headers = new Headers({ 'X-MIA-Sales-Intent': salesIntent })
  if (conversationId) {
    headers.set('X-MIA-Conversation-Id', conversationId)
  }
  return {
    ok: true,
    status: 200,
    headers,
    body: {
      getReader: () => {
        const encoder = new TextEncoder()
        let sent = false
        return {
          read: async () => {
            if (!sent) {
              sent = true
              return { done: false, value: encoder.encode(bodyText) }
            }
            return { done: true, value: undefined }
          },
        }
      },
    },
  }
}

const chatFetch = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  chatFetch.mockImplementation(async () => streamResponse())
  vi.stubGlobal('fetch', chatFetch)
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  })
})

describe('ChatWindow widget sale flow', () => {
  it('captura X-MIA-Conversation-Id y registra la venta al confirmar', async () => {
    const closeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ recorded: true }),
    })
    chatFetch.mockImplementation(async (url: string) =>
      url === '/api/widget/close' ? closeFetch() : streamResponse()
    )

    render(
      <ChatWindow
        assistantName="MIA"
        assistantId="assistant-1"
        apiEndpoint="/api/widget/chat"
        customerExternalId="visitor-1"
        customerName="Juan"
        widgetCloseEndpoint="/api/widget/close"
        landingContext={{ landingId: 'landing-1', product: 'Combo 1' }}
      />
    )

    fireEvent.change(screen.getByPlaceholderText('Escribe tu mensaje...'), {
      target: { value: 'quiero comprar' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))

    const buyButton = await screen.findByText('Comprar ahora')
    fireEvent.click(buyButton)

    await waitFor(() => {
      expect(closeFetch).toHaveBeenCalledTimes(1)
    })

    const closeCall = chatFetch.mock.calls.find(
      ([url]) => url === '/api/widget/close'
    )?.[1]
    const closeBody = JSON.parse(closeCall.body)
    expect(closeBody.assistantId).toBe('assistant-1')
    expect(closeBody.conversationId).toBe('conv-1')
    expect(closeBody.customerExternalId).toBe('visitor-1')
    expect(closeBody.customerName).toBe('Juan')
    expect(closeBody.landingContext.product).toBe('Combo 1')

    expect(await screen.findByText('Pedido registrado ✓')).toBeInTheDocument()
  })

  it('no registra la venta si la conversacion aun no existe', async () => {
    const closeFetch = vi.fn()
    chatFetch.mockImplementation(async (url: string) =>
      url === '/api/widget/close' ? closeFetch() : streamResponse({ conversationId: null })
    )

    render(
      <ChatWindow
        assistantName="MIA"
        assistantId="assistant-1"
        apiEndpoint="/api/widget/chat"
        customerExternalId="visitor-1"
        widgetCloseEndpoint="/api/widget/close"
        landingContext={{ landingId: 'landing-1' }}
      />
    )

    fireEvent.change(screen.getByPlaceholderText('Escribe tu mensaje...'), {
      target: { value: 'hola' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))

    const buyButton = await screen.findByText('Comprar ahora')
    fireEvent.click(buyButton)

    await waitFor(() => {
      expect(closeFetch).not.toHaveBeenCalled()
    })
  })

  it('muestra estado de error si el registro falla', async () => {
    const closeFetch = vi.fn().mockRejectedValue(new Error('network'))
    chatFetch.mockImplementation(async (url: string) =>
      url === '/api/widget/close' ? closeFetch() : streamResponse()
    )

    render(
      <ChatWindow
        assistantName="MIA"
        assistantId="assistant-1"
        apiEndpoint="/api/widget/chat"
        customerExternalId="visitor-1"
        widgetCloseEndpoint="/api/widget/close"
        landingContext={{ landingId: 'landing-1' }}
      />
    )

    fireEvent.change(screen.getByPlaceholderText('Escribe tu mensaje...'), {
      target: { value: 'quiero comprar' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))

    const buyButton = await screen.findByText('Comprar ahora')
    fireEvent.click(buyButton)

    await waitFor(() => {
      expect(screen.getByText('Abriendo formulario…')).toBeInTheDocument()
    })
  })
})
