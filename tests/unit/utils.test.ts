import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cn, formatTimeAgo } from '@/lib/utils'

describe('cn', () => {
  it('combina clases y resuelve conflictos de tailwind', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
    expect(cn('text-red-500', 'text-blue-500')).toContain('text-blue-500')
  })

  it('ignora valores falsy', () => {
    expect(cn('a', undefined, false, null, 'b')).toBe('a b')
  })
})

describe('formatTimeAgo', () => {
  const NOW = new Date('2026-08-04T12:00:00Z')

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('devuelve Sin interacciones para fecha nula', () => {
    expect(formatTimeAgo(null)).toBe('Sin interacciones')
  })

  it('devuelve Ahora mismo para menos de 1 min', () => {
    const d = new Date(NOW.getTime() - 30_000).toISOString()
    expect(formatTimeAgo(d)).toBe('Ahora mismo')
  })

  it('devuelve hace X min', () => {
    const d = new Date(NOW.getTime() - 5 * 60_000).toISOString()
    expect(formatTimeAgo(d)).toBe('Hace 5 min')
  })

  it('devuelve hace Xh', () => {
    const d = new Date(NOW.getTime() - 3 * 60 * 60_000).toISOString()
    expect(formatTimeAgo(d)).toBe('Hace 3h')
  })

  it('devuelve Ayer', () => {
    const d = new Date(NOW.getTime() - 24 * 60 * 60_000).toISOString()
    expect(formatTimeAgo(d)).toBe('Ayer')
  })

  it('devuelve hace X dias', () => {
    const d = new Date(NOW.getTime() - 5 * 24 * 60 * 60_000).toISOString()
    expect(formatTimeAgo(d)).toBe('Hace 5 días')
  })
})
