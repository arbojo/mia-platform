import { describe, it, expect } from 'vitest'
import { allowsSideEffects } from '@/lib/channels/mode'

describe('allowsSideEffects', () => {
  it('allows real side effects in active', () => {
    expect(allowsSideEffects('active')).toBe(true)
  })

  // Shadow reaches the Core on purpose (the AI must think and learn) but must
  // never emit a sales event, because the delivery/inventory triggers would
  // turn a hypothetical SALE_WON into a real order.
  it('blocks side effects in shadow', () => {
    expect(allowsSideEffects('shadow')).toBe(false)
  })

  it('blocks side effects in paused', () => {
    expect(allowsSideEffects('paused')).toBe(false)
  })

  // Web Chat / training / laboratorio have no channel behind them and must keep
  // their existing deliver-everything behaviour.
  it('keeps legacy behaviour when no mode is supplied', () => {
    expect(allowsSideEffects(undefined)).toBe(true)
    expect(allowsSideEffects(null)).toBe(true)
  })
})