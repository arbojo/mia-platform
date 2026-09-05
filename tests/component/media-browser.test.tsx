import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Database } from '@/lib/types'

type KnowledgeItem = Database['public']['Tables']['knowledge_items']['Row']

vi.mock('@/components/knowledge/MediaUpload', () => ({
  MediaUpload: ({ onUploaded }: { onUploaded: (url: string) => void }) => (
    <button type="button" onClick={() => onUploaded('https://example.com/uploaded.jpg')}>
      subir
    </button>
  ),
}))

import { MediaBrowser } from '@/components/knowledge/MediaBrowser'
import { MediaEditDialog } from '@/components/knowledge/MediaEditDialog'

type FetchCall = { url: string; init?: RequestInit }

function installFetch() {
  const calls: FetchCall[] = []
  const fetchMock = vi.fn(
    async (url: unknown, init?: RequestInit): Promise<Response> => {
      calls.push({ url: String(url), init })
      return { ok: true, status: 200, json: async () => ({ items: [], item: { id: 'new' } }) } as unknown as Response
    }
  )
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, calls }
}

function makeItem(overrides: Partial<KnowledgeItem>): KnowledgeItem {
  const base: KnowledgeItem = {
    id: 'i1',
    business_id: 'business-1',
    category: 'tip',
    question: 'Q',
    answer: 'Medio de prueba',
    source: 'manual',
    confidence: 'high',
    image_url: 'https://example.com/img.jpg',
    trigger_condition: null,
    media_type: 'image',
    product_id: null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  return { ...base, ...overrides }
}

const PRODUCT_ID = '11111111-2222-3333-4444-555555555555'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MediaBrowser — creación contractual (R1.3, INV-MEDIA-001)', () => {
  it('crea media de producto condicionada (trigger presente)', async () => {
    const { calls } = installFetch()
    render(
      <MediaBrowser
        businessId="business-1"
        header="Multimedia"
        hint="h"
        productId={PRODUCT_ID}
        productNames={{ [PRODUCT_ID]: 'Back2Fit' }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /subir/i }))
    fireEvent.change(screen.getByLabelText(/Descripción semántica/i), {
      target: { value: 'Foto del producto' },
    })
    fireEvent.change(screen.getByLabelText(/Condición de envío/i), {
      target: { value: 'foto, tallas' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Guardar medio/i }))

    await waitFor(() => {
      const post = calls.find(
        (c) => c.init?.method === 'POST' && c.url === '/api/knowledge/items'
      )
      expect(post).toBeDefined()
      const body = JSON.parse(String(post!.init!.body))
      expect(body).toMatchObject({
        product_id: PRODUCT_ID,
        trigger_condition: 'foto, tallas',
      })
    })
  })

  it('crea media de producto incondicional (trigger NULL)', async () => {
    const { calls } = installFetch()
    render(
      <MediaBrowser
        businessId="business-1"
        header="Multimedia"
        hint="h"
        productId={PRODUCT_ID}
        productNames={{ [PRODUCT_ID]: 'Back2Fit' }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /subir/i }))
    fireEvent.change(screen.getByLabelText(/Descripción semántica/i), {
      target: { value: 'Foto principal' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Guardar medio/i }))

    await waitFor(() => {
      const post = calls.find(
        (c) => c.init?.method === 'POST' && c.url === '/api/knowledge/items'
      )
      expect(post).toBeDefined()
      const body = JSON.parse(String(post!.init!.body))
      expect(body).toMatchObject({
        product_id: PRODUCT_ID,
        trigger_condition: null,
      })
    })
  })

  it('crea media genérica condicionada', async () => {
    const { calls } = installFetch()
    render(<MediaBrowser businessId="business-1" header="Medios generales" hint="h" />)
    fireEvent.click(screen.getByRole('button', { name: /subir/i }))
    fireEvent.change(screen.getByLabelText(/Descripción semántica/i), {
      target: { value: 'Logo de marca' },
    })
    fireEvent.change(screen.getByLabelText(/Condición de envío/i), {
      target: { value: 'resultados' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Guardar medio/i }))

    await waitFor(() => {
      const post = calls.find(
        (c) => c.init?.method === 'POST' && c.url === '/api/knowledge/items'
      )
      expect(post).toBeDefined()
      const body = JSON.parse(String(post!.init!.body))
      expect(body).toMatchObject({
        product_id: null,
        trigger_condition: 'resultados',
      })
    })
  })

  it('crea media genérica incondicional (product_id NULL + trigger NULL) — regresión canCreate', async () => {
    const { calls } = installFetch()
    render(<MediaBrowser businessId="business-1" header="Medios generales" hint="h" />)
    fireEvent.click(screen.getByRole('button', { name: /subir/i }))
    fireEvent.change(screen.getByLabelText(/Descripción semántica/i), {
      target: { value: 'Genérica sin condición' },
    })
    const saveButton = screen.getByRole('button', {
      name: /Guardar medio/i,
    }) as HTMLButtonElement
    expect(saveButton.disabled).toBe(false)
    fireEvent.click(saveButton)

    await waitFor(() => {
      const post = calls.find(
        (c) => c.init?.method === 'POST' && c.url === '/api/knowledge/items'
      )
      expect(post).toBeDefined()
      const body = JSON.parse(String(post!.init!.body))
      expect(body).toMatchObject({
        product_id: null,
        trigger_condition: null,
      })
    })
  })
})

describe('MediaEditDialog — edición contractual', () => {
  it('preserva trigger NULL y NO envía product_id en PATCH', async () => {
    const { calls } = installFetch()
    render(
      <MediaEditDialog
        item={makeItem({ id: 'item-1', trigger_condition: null, product_id: PRODUCT_ID })}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
      />
    )
    fireEvent.change(screen.getByLabelText(/Descripción semántica/i), {
      target: { value: 'Nueva descripción' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }))

    await waitFor(() => {
      const patch = calls.find(
        (c) => c.init?.method === 'PATCH' && c.url === '/api/knowledge/items/item-1'
      )
      expect(patch).toBeDefined()
      const body = JSON.parse(String(patch!.init!.body))
      expect(body.trigger_condition).toBeNull()
      expect(body).not.toHaveProperty('product_id')
    })
  })

  it('limpiar el trigger lo degrada a NULL', async () => {
    const { calls } = installFetch()
    render(
      <MediaEditDialog
        item={makeItem({ id: 'item-1', trigger_condition: 'precio' })}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
      />
    )
    fireEvent.change(screen.getByLabelText(/Condición de envío/i), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }))

    await waitFor(() => {
      const patch = calls.find(
        (c) => c.init?.method === 'PATCH' && c.url === '/api/knowledge/items/item-1'
      )
      expect(patch).toBeDefined()
      const body = JSON.parse(String(patch!.init!.body))
      expect(body.trigger_condition).toBeNull()
    })
  })

  it('editar un trigger presente lo conserva', async () => {
    const { calls } = installFetch()
    render(
      <MediaEditDialog
        item={makeItem({ id: 'item-1', trigger_condition: 'precio' })}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
      />
    )
    fireEvent.change(screen.getByLabelText(/Condición de envío/i), {
      target: { value: 'precio, cuotas' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }))

    await waitFor(() => {
      const patch = calls.find(
        (c) => c.init?.method === 'PATCH' && c.url === '/api/knowledge/items/item-1'
      )
      expect(patch).toBeDefined()
      const body = JSON.parse(String(patch!.init!.body))
      expect(body.trigger_condition).toBe('precio, cuotas')
    })
  })
})