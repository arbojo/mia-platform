import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Database } from '@/lib/types'
import { MediaGrid } from '@/components/knowledge/MediaGrid'

type KnowledgeItem = Database['public']['Tables']['knowledge_items']['Row']

const PRODUCT_ID = '11111111-2222-3333-4444-555555555555'

const base: KnowledgeItem = {
  id: 'i1',
  business_id: 'business-1',
  category: 'tip',
  question: 'Q',
  answer: 'Medio',
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

function makeItem(overrides: Partial<KnowledgeItem>): KnowledgeItem {
  return { ...base, ...overrides }
}

const handlers = { onEdit: vi.fn(), onDelete: vi.fn() }

describe('MediaGrid — representación de estados de envío (presentación)', () => {
  it('muestra condicionado para producto con trigger', () => {
    render(
      <MediaGrid
        items={[makeItem({ product_id: PRODUCT_ID, trigger_condition: 'precio' })]}
        emptyMessage="Sin medios"
        productNames={{ [PRODUCT_ID]: 'Back2Fit' }}
        {...handlers}
      />
    )
    expect(screen.getByText(/Se envía cuando:/)).toBeInTheDocument()
    expect(screen.getByText('precio')).toBeInTheDocument()
    expect(screen.getByText('Back2Fit')).toBeInTheDocument()
  })

  it('muestra incondicional de producto (sin trigger)', () => {
    render(
      <MediaGrid
        items={[makeItem({ product_id: PRODUCT_ID, trigger_condition: null })]}
        emptyMessage="Sin medios"
        productNames={{ [PRODUCT_ID]: 'Back2Fit' }}
        {...handlers}
      />
    )
    expect(screen.getByText(/Incondicional · acompaña al producto/)).toBeInTheDocument()
    expect(screen.queryByText(/Genérica/)).not.toBeInTheDocument()
  })

  it('muestra genérica incondicional (product_id NULL + trigger NULL)', () => {
    render(
      <MediaGrid
        items={[makeItem({ product_id: null, trigger_condition: null })]}
        emptyMessage="Sin medios"
        {...handlers}
      />
    )
    expect(screen.getByText('Genérica')).toBeInTheDocument()
    expect(
      screen.getByText(/Incondicional · genérica: acompaña al producto en contexto/)
    ).toBeInTheDocument()
  })

  it('muestra genérica condicionada', () => {
    render(
      <MediaGrid
        items={[makeItem({ product_id: null, trigger_condition: 'resultados' })]}
        emptyMessage="Sin medios"
        {...handlers}
      />
    )
    expect(screen.getByText(/Genérica · Se envía cuando:/)).toBeInTheDocument()
    expect(screen.getByText('resultados')).toBeInTheDocument()
  })
})