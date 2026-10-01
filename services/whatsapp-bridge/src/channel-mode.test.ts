import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChannelModeCache, allowsOutbound } from './channel-mode.js'

describe('allowsOutbound', () => {
  it('only allows active', () => {
    expect(allowsOutbound('active')).toBe(true)
    expect(allowsOutbound('shadow')).toBe(false)
    expect(allowsOutbound('paused')).toBe(false)
  })

  // The failure that matters: if the bridge cannot read the mode (DB error,
  // missing row, first call before any cache warm) it must stay silent. A
  // defensive auto-reply that leaks into a shadow rehearsal is unrecoverable.
  it('fails closed when the mode is unknown', () => {
    expect(allowsOutbound(null)).toBe(false)
    expect(allowsOutbound(undefined)).toBe(false)
  })
})

describe('ChannelModeCache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('returns undefined for an unknown business (forces a read)', () => {
    const cache = new ChannelModeCache(1000)
    expect(cache.get('b1')).toBeUndefined()
  })

  it('serves a cached value without re-reading', () => {
    const cache = new ChannelModeCache(1000)
    cache.set('b1', 'shadow')
    expect(cache.get('b1')).toBe('shadow')
  })

  it('expires so a mode change is honoured quickly', () => {
    const cache = new ChannelModeCache(1000)
    cache.set('b1', 'active')
    vi.advanceTimersByTime(1001)
    expect(cache.get('b1')).toBeUndefined()
  })

  it('caches null as a real answer, not a miss', () => {
    const cache = new ChannelModeCache(1000)
    cache.set('b1', null)
    expect(cache.get('b1')).toBeNull()
    expect(cache.get('b1')).not.toBeUndefined()
  })

  it('invalidate forces the next call to re-read', () => {
    const cache = new ChannelModeCache(1000)
    cache.set('b1', 'active')
    cache.invalidate('b1')
    expect(cache.get('b1')).toBeUndefined()
  })

  it('keeps businesses independent', () => {
    const cache = new ChannelModeCache(1000)
    cache.set('b1', 'shadow')
    cache.set('b2', 'active')
    cache.invalidate('b1')
    expect(cache.get('b1')).toBeUndefined()
    expect(cache.get('b2')).toBe('active')
  })

  it('stays bounded under unbounded distinct business ids', () => {
    const cache = new ChannelModeCache(1000, 10)
    for (let i = 0; i < 100; i++) cache.set(`b${i}`, 'active')
    let alive = 0
    for (let i = 0; i < 100; i++) if (cache.get(`b${i}`) !== undefined) alive++
    expect(alive).toBeLessThanOrEqual(10)
  })

  it('evicts expired entries before evicting live ones', () => {
    const cache = new ChannelModeCache(1000, 4)
    cache.set('old1', 'active')
    cache.set('old2', 'active')
    vi.advanceTimersByTime(1500)
    cache.set('fresh1', 'shadow')
    cache.set('fresh2', 'shadow')
    cache.set('fresh3', 'shadow')
    expect(cache.get('fresh1')).toBe('shadow')
    expect(cache.get('fresh2')).toBe('shadow')
  })
})