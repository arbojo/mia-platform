import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useTypingIndicator } from '@/lib/chat/useTypingIndicator'

describe('useTypingIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('startTyping enciende el indicador', () => {
    const { result } = renderHook(() => useTypingIndicator())
    expect(result.current.isTyping).toBe(false)

    act(() => result.current.startTyping())
    expect(result.current.isTyping).toBe(true)
  })

  it('stopTyping inmediato mantiene el mínimo de visibilidad', () => {
    const { result } = renderHook(() => useTypingIndicator())

    act(() => result.current.startTyping())
    act(() => result.current.stopTyping())
    expect(result.current.isTyping).toBe(true)

    act(() => vi.advanceTimersByTime(599))
    expect(result.current.isTyping).toBe(true)

    act(() => vi.advanceTimersByTime(1))
    expect(result.current.isTyping).toBe(false)
  })

  it('stopTyping después del mínimo oculta de inmediato', () => {
    const { result } = renderHook(() => useTypingIndicator())

    act(() => result.current.startTyping())
    act(() => vi.advanceTimersByTime(700))
    act(() => result.current.stopTyping())

    expect(result.current.isTyping).toBe(false)
  })

  it('startTyping cancela un ocultado pendiente', () => {
    const { result } = renderHook(() => useTypingIndicator())

    act(() => result.current.startTyping())
    act(() => result.current.stopTyping())
    act(() => result.current.startTyping())

    act(() => vi.advanceTimersByTime(600))
    expect(result.current.isTyping).toBe(true)
  })
})
