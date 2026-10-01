import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  SentMessageRegistry,
  extractSentMessageId,
  SENT_REGISTRY_TTL_MS,
} from './sent-registry.js'

describe('extractSentMessageId', () => {
  it('reads key.id from the WAMessage returned by sendMessage', () => {
    expect(extractSentMessageId({ key: { id: 'ABC123' } })).toBe('ABC123')
  })

  it('reads key.id when Baileys wraps the message one level deeper', () => {
    expect(extractSentMessageId({ message: { key: { id: 'WRAPPED1' } } })).toBe('WRAPPED1')
  })

  it('returns null for shapes we do not recognise (fail closed)', () => {
    expect(extractSentMessageId(null)).toBeNull()
    expect(extractSentMessageId(undefined)).toBeNull()
    expect(extractSentMessageId('string')).toBeNull()
    expect(extractSentMessageId({})).toBeNull()
    expect(extractSentMessageId({ key: {} })).toBeNull()
    expect(extractSentMessageId({ key: { id: '' } })).toBeNull()
    expect(extractSentMessageId({ key: { id: 12345 } })).toBeNull()
  })
})

describe('SentMessageRegistry', () => {
  let registry: SentMessageRegistry

  beforeEach(() => {
    registry = new SentMessageRegistry()
  })

  it('recognises ids sent by this bridge', () => {
    registry.add('biz-1', ['MSG1'])
    expect(registry.has('biz-1', 'MSG1')).toBe(true)
  })

  it('does NOT recognise a message the bridge never sent', () => {
    registry.add('biz-1', ['MSG1'])
    expect(registry.has('biz-1', 'HUMAN1')).toBe(false)
  })

  it('scopes ids per business so tenants cannot collide', () => {
    registry.add('biz-1', ['SHARED'])
    expect(registry.has('biz-2', 'SHARED')).toBe(false)
  })

  it('registers several ids at once (interactive sends emit more than one upsert)', () => {
    registry.add('biz-1', ['A', 'B', 'C'])
    expect(registry.has('biz-1', 'A')).toBe(true)
    expect(registry.has('biz-1', 'B')).toBe(true)
    expect(registry.has('biz-1', 'C')).toBe(true)
  })

  it('ignores null/undefined ids without polluting the store', () => {
    registry.add('biz-1', [null, undefined, '', 'REAL'])
    expect(registry.has('biz-1', '')).toBe(false)
    expect(registry.has('biz-1', 'REAL')).toBe(true)
  })

  it('returns false for an empty id', () => {
    expect(registry.has('biz-1', '')).toBe(false)
  })

  it('expires ids after the TTL so a recycled id cannot leak forever', () => {
    vi.useFakeTimers()
    try {
      const shortLived = new SentMessageRegistry(1_000)
      shortLived.add('biz-1', ['OLD'])

      expect(shortLived.has('biz-1', 'OLD')).toBe(true)
      vi.advanceTimersByTime(1_500)
      expect(shortLived.has('biz-1', 'OLD')).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('forgets everything for a business on clear (logout/disconnect)', () => {
    registry.add('biz-1', ['X', 'Y'])
    registry.clear('biz-1')
    expect(registry.has('biz-1', 'X')).toBe(false)
    expect(registry.has('biz-1', 'Y')).toBe(false)
  })

  // ── The regression that motivates this whole module ────────────────────────
  // The salesperson replies from the SAME number as the bridge, so `fromMe` is
  // ambiguous. Without the registry, treating fromMe as "human" makes MIA read
  // its own reply as a customer message and answer back — an infinite loop.
  it('separates MIA own replies from human messages sharing the same number', () => {
    // MIA answers; the bridge records the id the socket returned.
    const ownReplyId = 'MIA-REPLY-1'
    registry.add('biz-1', [ownReplyId])

    // Baileys echoes both back with fromMe=true.
    expect(registry.has('biz-1', ownReplyId)).toBe(true) // -> discarded
    expect(registry.has('biz-1', 'SALESWOMAN-1')).toBe(false) // -> forwarded for learning
  })
})

describe('SentMessageRegistry (reals)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('survives a long TTL window by design (late upserts after reconnect)', () => {
    vi.useFakeTimers()
    try {
      const registry = new SentMessageRegistry()
      registry.add('biz-1', ['LATE'])
      vi.advanceTimersByTime(SENT_REGISTRY_TTL_MS - 1_000)
      expect(registry.has('biz-1', 'LATE')).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})