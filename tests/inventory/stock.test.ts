import { describe, it, expect } from 'vitest'
import { saleQuantities, buildStockListing } from '@/lib/inventory/stock'

describe('saleQuantities', () => {
  it('maps quantities from metadata items', () => {
    const result = saleQuantities({
      product_id: null,
      metadata: {
        items: [
          { product_id: 'p1', quantity: 2 },
          { product_id: 'p2', quantity: 1 },
        ],
      },
      created_at: '2026-08-01T00:00:00Z',
    })
    expect(result.get('p1')).toBe(2)
    expect(result.get('p2')).toBe(1)
  })

  it('aggregates repeated products across lines', () => {
    const result = saleQuantities({
      product_id: null,
      metadata: {
        items: [
          { product_id: 'p1', quantity: 1 },
          { product_id: 'p1', quantity: 3 },
        ],
      },
      created_at: '2026-08-01T00:00:00Z',
    })
    expect(result.get('p1')).toBe(4)
  })

  it('falls back to product_id with quantity 1 when there are no items', () => {
    const result = saleQuantities({
      product_id: 'p9',
      metadata: {},
      created_at: '2026-08-01T00:00:00Z',
    })
    expect(result.get('p9')).toBe(1)
  })

  it('ignores lines without product_id', () => {
    const result = saleQuantities({
      product_id: null,
      metadata: { items: [{ quantity: 1 }] },
      created_at: '2026-08-01T00:00:00Z',
    })
    expect(result.size).toBe(0)
  })
})

describe('buildStockListing', () => {
  const baseInput = {
    businessId: 'b1',
    products: [
      { id: 'p1', name: 'Producto A', sku: 'SKU-A', price: 100 },
      { id: 'p2', name: 'Producto B', sku: null, price: 200 },
    ],
    stockByProduct: {
      p1: { quantity: 3, low_stock_threshold: 5 },
    },
    sales30d: [
      {
        product_id: 'p1',
        metadata: { items: [{ product_id: 'p1', quantity: 2 }] },
        created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      },
    ],
  }

  it('joins products with stock and computes status', () => {
    const items = buildStockListing(baseInput)
    const a = items.find((i) => i.product_id === 'p1')!
    const b = items.find((i) => i.product_id === 'p2')!

    expect(a.product_name).toBe('Producto A')
    expect(a.quantity).toBe(3)
    expect(a.status).toBe('low')

    expect(b.quantity).toBe(0)
    expect(b.status).toBe('out')
  })

  it('computes velocity from the sales window', () => {
    const a = buildStockListing(baseInput).find((i) => i.product_id === 'p1')!
    expect(a.velocity7d).toBe(2)
    expect(a.velocity30d).toBe(2)
    expect(a.daysOut).toBe(2)
  })

  it('reports no sales when the product has none', () => {
    const b = buildStockListing(baseInput).find((i) => i.product_id === 'p2')!
    expect(b.daysOut).toBeNull()
    expect(b.velocity7d).toBe(0)
  })
})
