import { describe, it, expect } from 'vitest'
import { canServeTraffic } from '@/lib/runtime/assistant-gate'

describe('canServeTraffic — canonical runtime gate', () => {
  it('allows active + ready', () => {
    expect(canServeTraffic(true, 'ready')).toBe(true)
  })

  it('allows active + active', () => {
    expect(canServeTraffic(true, 'active')).toBe(true)
  })

  it('allows active + draft', () => {
    expect(canServeTraffic(true, 'draft')).toBe(true)
  })

  it('allows active + training', () => {
    expect(canServeTraffic(true, 'training')).toBe(true)
  })

  it('blocks inactive status regardless of is_active', () => {
    expect(canServeTraffic(true, 'inactive')).toBe(false)
    expect(canServeTraffic(false, 'inactive')).toBe(false)
  })

  it('blocks is_active=false regardless of status', () => {
    expect(canServeTraffic(false, 'active')).toBe(false)
    expect(canServeTraffic(false, 'ready')).toBe(false)
    expect(canServeTraffic(false, 'draft')).toBe(false)
    expect(canServeTraffic(false, 'training')).toBe(false)
  })

  it('blocks null/undefined status when is_active=false', () => {
    expect(canServeTraffic(false, null)).toBe(false)
    expect(canServeTraffic(false, undefined)).toBe(false)
  })

  it('allows null/undefined status when is_active=true', () => {
    expect(canServeTraffic(true, null)).toBe(true)
    expect(canServeTraffic(true, undefined)).toBe(true)
  })
})