import { describe, it, expect } from 'vitest'
import { normalizeBurstText, BurstGuard } from '../../services/whatsapp-bridge/src/burst-guard'

describe('normalizeBurstText', () => {
  it('lowercases, collapses spaces and trims', () => {
    expect(normalizeBurstText('  Hola   Mundo\nAdiós  ')).toBe('hola mundo adiós')
  })

  it('returns empty for whitespace-only', () => {
    expect(normalizeBurstText('   \n\t  ')).toBe('')
  })
})

describe('BurstGuard', () => {
  it('detects repeat within window', () => {
    const guard = new BurstGuard({ windowMs: 2000 })
    const businessId = 'biz1'
    const jid = '123@s.whatsapp.net'
    const now = 1000
    expect(guard.isRepeat(businessId, jid, 'Hola', now)).toBe(false)
    guard.record(businessId, jid, 'Hola', now)
    expect(guard.isRepeat(businessId, jid, 'hola', now + 500)).toBe(true)
    expect(guard.isRepeat(businessId, jid, 'adios', now + 500)).toBe(false)
  })

  it('does not flag after window expires', () => {
    const guard = new BurstGuard({ windowMs: 1000 })
    const businessId = 'biz1'
    const jid = '123@s.whatsapp.net'
    const now = 1000
    guard.record(businessId, jid, 'Hola', now)
    expect(guard.isRepeat(businessId, jid, 'Hola', now + 1500)).toBe(false)
  })

  it('clears by businessId', () => {
    const guard = new BurstGuard({ windowMs: 5000 })
    const businessId = 'biz1'
    const jid = '123@s.whatsapp.net'
    const now = 1000
    guard.record(businessId, jid, 'Hola', now)
    guard.clear(businessId)
    expect(guard.isRepeat(businessId, jid, 'Hola', now + 100)).toBe(false)
  })

  it('prunes when exceeding maxEntries', () => {
    const guard = new BurstGuard({ windowMs: 60_000, maxEntries: 2 })
    const businessId = 'biz1'
    const jid1 = '1@s.whatsapp.net'
    const jid2 = '2@s.whatsapp.net'
    const jid3 = '3@s.whatsapp.net'
    const now = 1000
    guard.record(businessId, jid1, 'a', now)
    guard.record(businessId, jid2, 'b', now + 1)
    // exceed maxEntries by recording third
    guard.record(businessId, jid3, 'c', now + 2)
    // jid1 is oldest, should be evicted
    expect(guard.isRepeat(businessId, jid1, 'a', now + 5000)).toBe(false)
    expect(guard.isRepeat(businessId, jid2, 'b', now + 5000)).toBe(true)
    expect(guard.isRepeat(businessId, jid3, 'c', now + 5000)).toBe(true)
  })
})





