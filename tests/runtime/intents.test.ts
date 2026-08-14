import { describe, it, expect } from 'vitest'
import {
  detectIntent,
  intentFromPayload,
  intentButtonId,
  buildInteractiveForIntent,
} from '@/lib/runtime/intents'
import type { MessagePayload } from '@/lib/channels/types'
import type { Database } from '@/lib/types'

type Product = Database['public']['Tables']['products']['Row']

const product: Product = {
  id: 'p1',
  business_id: 'b1',
  name: 'Bota de Cuero',
  sku: null,
  price: 150,
  description: 'Bota de cuero genuino',
  benefits: 'Duradera',
  faq: null,
  restrictions: null,
  image_url: null,
  documents: [],
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const productInactive: Product = { ...product, id: 'p2', name: 'Oculto', is_active: false }

describe('detectIntent', () => {
  it('detects catalog intent from keywords', () => {
    expect(detectIntent('¿Qué productos tienen?')).toBe('catalog')
    expect(detectIntent('Quiero ver el catálogo')).toBe('catalog')
  })

  it('detects price intent', () => {
    expect(detectIntent('¿Cuánto cuesta la bota?')).toBe('price')
    expect(detectIntent('¿Cuál es el precio?')).toBe('price')
  })

  it('detects shipping intent', () => {
    expect(detectIntent('¿Hacen envíos a mi ciudad?')).toBe('shipping')
    expect(detectIntent('¿Cuánto tarda el envío?')).toBe('shipping')
  })

  it('detects greeting', () => {
    expect(detectIntent('Hola, buenas tardes')).toBe('greeting')
  })

  it('returns null for unrelated messages', () => {
    expect(detectIntent('¿a qué hora cierran?')).toBeNull()
  })

  it('prioritizes payload intent over keywords', () => {
    const payload: MessagePayload = { type: 'quick_reply', id: 'intent:shipping', title: 'Envíos' }
    expect(detectIntent('cualquier cosa', payload)).toBe('shipping')
  })
})

describe('intentFromPayload', () => {
  it('extracts intent tag from quick_reply payload', () => {
    expect(intentFromPayload({ type: 'quick_reply', id: 'intent:payment', title: 'Pago' })).toBe('payment')
  })

  it('returns null for list payloads', () => {
    expect(intentFromPayload({ type: 'list', id: 'p1', title: 'Bota' })).toBeNull()
  })

  it('returns null for unknown intent ids', () => {
    expect(intentFromPayload({ type: 'quick_reply', id: 'intent:unknown', title: '?' })).toBeNull()
  })
})

describe('intentButtonId', () => {
  it('prepends the intent prefix', () => {
    expect(intentButtonId('contact')).toBe('intent:contact')
  })
})

describe('buildInteractiveForIntent', () => {
  it('builds a list message with active products for catalog intent', () => {
    const interactive = buildInteractiveForIntent('catalog', [product, productInactive], 'Estos son nuestros productos')
    expect(interactive?.type).toBe('list')
    if (interactive?.type === 'list') {
      expect(interactive.sections[0].rows).toHaveLength(1)
      expect(interactive.sections[0].rows[0]).toMatchObject({ id: 'p1', title: 'Bota de Cuero' })
    }
  })

  it('builds quick reply for greeting intent', () => {
    const interactive = buildInteractiveForIntent('greeting', [], 'Hola, ¿en qué te ayudo?')
    expect(interactive?.type).toBe('quick_reply')
    if (interactive?.type === 'quick_reply') {
      expect(interactive.buttons.length).toBeLessThanOrEqual(3)
    }
  })

  it('returns null when catalog has no active products', () => {
    expect(buildInteractiveForIntent('catalog', [], 'Nada')).toBeNull()
    expect(buildInteractiveForIntent('catalog', [productInactive], 'Nada')).toBeNull()
  })
})
