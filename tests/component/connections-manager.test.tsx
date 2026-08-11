import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ConnectionsManager } from '@/components/connections/ConnectionsManager'
import { ContextMenuProvider } from '@/components/ui/context-menu'

const h = vi.hoisted(() => ({
  connections: [] as Array<Record<string, unknown>>,
  assistants: [{ id: 'a1', name: 'Vendedor' }] as Array<{ id: string; name: string }>,
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'u1' } } }),
    },
    from: (table: string) => {
      const finalize = (rows: unknown[]) => Promise.resolve({ data: rows, error: null })
      if (table === 'businesses') {
        return { select: () => ({ eq: () => ({ limit: () => finalize([{ id: 'b1' }]) }) }) }
      }
      if (table === 'channel_connections') {
        return { select: () => ({ eq: () => ({ order: () => finalize(h.connections) }) }) }
      }
      if (table === 'assistants') {
        return { select: () => ({ eq: () => ({ eq: () => finalize(h.assistants) }) }) }
      }
      return { select: () => ({ eq: () => ({ order: () => finalize([]) }) }) }
    },
  }),
}))

class MockWebSocket {
  static instances: MockWebSocket[] = []
  onmessage: ((ev: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null
  close = vi.fn(() => {})
  constructor(public url: string) {
    MockWebSocket.instances.push(this)
  }
  emit(msg: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(msg) })
  }
}

function ok(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body }
}

function renderManager() {
  return render(
    <ContextMenuProvider>
      <ConnectionsManager whatsAppEnabled />
    </ContextMenuProvider>
  )
}

describe('ConnectionsManager WhatsApp flow', () => {
  beforeEach(() => {
    h.connections.length = 0
    MockWebSocket.instances.length = 0
    vi.stubGlobal('WebSocket', MockWebSocket)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('consulta el estado vivo al montar y muestra Desconectado + Reconectar cuando la sesion persiste', async () => {
    h.connections.push({
      id: 'wa-1',
      business_id: 'b1',
      assistant_id: 'a1',
      channel: 'whatsapp',
      status: 'disconnected',
      mode: 'active',
      configuration: {},
      last_sync: null,
      created_at: '2026-08-10T00:00:00.000Z',
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/session') ? ok({ success: true, status: 'disconnected', phone: null, bridgeEnabled: true }) : ok({})
      )
    )

    renderManager()

    expect((await screen.findAllByText('Desconectado')).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Estado' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Reconectar' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Limpiar sesion' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Conectar WhatsApp' })).not.toBeInTheDocument()
  })

  it('muestra Conectar WhatsApp cuando no hay sesion persistida y el bridge reporta desconectado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/session') ? ok({ success: true, status: 'disconnected', phone: null, bridgeEnabled: true }) : ok({})
      )
    )

    renderManager()

    expect(await screen.findByText('No conectado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Conectar WhatsApp' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reconectar' })).not.toBeInTheDocument()
  })

  it('refleja el estado conectado del bridge al montar', async () => {
    h.connections.push({
      id: 'wa-1',
      business_id: 'b1',
      assistant_id: 'a1',
      channel: 'whatsapp',
      status: 'connected',
      mode: 'active',
      configuration: {},
      last_sync: null,
      created_at: '2026-08-10T00:00:00.000Z',
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/session')
          ? ok({ success: true, status: 'connected', phone: '5212345678', bridgeEnabled: true })
          : ok({})
      )
    )

    renderManager()

    expect(await screen.findByText('Conectado (5212345678)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desconectar' })).toBeInTheDocument()
  })

  it('Reconectar fuerza la reconexion via /reconnect y muestra el QR recibido por WebSocket', async () => {
    h.connections.push({
      id: 'wa-1',
      business_id: 'b1',
      assistant_id: 'a1',
      channel: 'whatsapp',
      status: 'disconnected',
      mode: 'active',
      configuration: {},
      last_sync: null,
      created_at: '2026-08-10T00:00:00.000Z',
    })

    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.includes('/reconnect')) return ok({ success: true, status: 'connecting' })
      if (url.includes('/ws-token'))
        return ok({ success: true, token: 't1', wsUrl: 'ws://localhost:3001/v1/ws', businessId: 'b1' })
      if (url.includes('/session'))
        return ok({ success: true, status: 'disconnected', phone: null, bridgeEnabled: true })
      return ok({})
    })
    vi.stubGlobal('fetch', fetchMock)

    renderManager()
    expect((await screen.findAllByText('Desconectado')).length).toBeGreaterThan(0)

    fireEvent.click(screen.getAllByRole('button', { name: 'Reconectar' })[0])

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/channels/baileys/reconnect',
        expect.objectContaining({ method: 'POST' })
      )
    })
    await waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1)
    })
    const ws = MockWebSocket.instances[0]
    expect(ws.url).toContain('/v1/ws?businessId=b1&token=t1')

    ws.emit({ type: 'qr', dataUrl: 'data:image/png;base64,abc' })

    expect(await screen.findByText('Generando codigo QR...')).toBeInTheDocument()
    expect(screen.getByAltText('Código QR de WhatsApp')).toBeInTheDocument()

    ws.emit({ type: 'status', status: 'connected', phone: '5212345678' })

    expect(await screen.findByText('Conectado (5212345678)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desconectar' })).toBeInTheDocument()
  })

  it('el boton Estado refresca el estado desde el bridge', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/session') ? ok({ success: true, status: 'disconnected', phone: null, bridgeEnabled: true }) : ok({})
      )
    )

    renderManager()
    await screen.findByText('No conectado')

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/session') ? ok({ success: true, status: 'connected', phone: null, bridgeEnabled: true }) : ok({})
      )
    )

    fireEvent.click(screen.getByRole('button', { name: 'Estado' }))

    expect(await screen.findByText('Conectado')).toBeInTheDocument()
  })
})
