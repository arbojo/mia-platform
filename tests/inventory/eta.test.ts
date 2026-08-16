import { describe, it, expect } from 'vitest'
import { computeEta, type EtaContext } from '@/lib/inventory/eta'

const base: EtaContext = {
  localQty: 0,
  transitQty: 0,
  transitEtaDays: null,
  purchaseQty: 0,
  purchaseEtaDays: null,
  leadTimeDays: 3,
}

describe('computeEta (espejo puro de inventory.calcular_eta)', () => {
  it('prioritiza stock local sobre tránsito y compra', () => {
    const result = computeEta({ ...base, localQty: 4, transitQty: 10, purchaseQty: 20 })
    expect(result.source).toBe('local')
    expect(result.eta_days).toBe(0)
    expect(result.available_qty).toBe(4)
  })

  it('usa stock en tránsito cuando no hay local', () => {
    const result = computeEta({ ...base, transitQty: 7, transitEtaDays: 2, purchaseQty: 5 })
    expect(result.source).toBe('transit')
    expect(result.eta_days).toBe(2)
    expect(result.available_qty).toBe(7)
  })

  it('no devuelve ETA negativa en tránsito vencido', () => {
    const result = computeEta({ ...base, transitQty: 7, transitEtaDays: -3 })
    expect(result.source).toBe('transit')
    expect(result.eta_days).toBe(0)
  })

  it('cae a compra externa cuando hay PO ordenada', () => {
    const result = computeEta({ ...base, purchaseQty: 12, purchaseEtaDays: 5 })
    expect(result.source).toBe('purchase')
    expect(result.eta_days).toBe(5)
    expect(result.available_qty).toBe(12)
  })

  it('cae a lead time externo cuando no hay stock comprometido', () => {
    const result = computeEta({ ...base, leadTimeDays: 7 })
    expect(result.source).toBe('purchase')
    expect(result.eta_days).toBe(7)
    expect(result.available_qty).toBe(0)
    expect(result.breakdown.lead_time_dias).toBe(7)
  })

  it('no deja que una PO sin ETA rompa el contrato', () => {
    const result = computeEta({ ...base, purchaseQty: 3, purchaseEtaDays: null })
    expect(result.source).toBe('purchase')
    expect(result.eta_days).toBe(0)
  })
})
