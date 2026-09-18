import { describe, it, expect, vi } from 'vitest'
import { withTypingIndicator, TYPING_REFRESH_MS } from '@/lib/channels/presence'
import type { ChannelAdapter, ChannelConnection } from '@/lib/channels/types'

const connection: ChannelConnection = {
  id: 'conn-1',
  businessId: 'b1',
  assistantId: 'a1',
  channel: 'messenger',
  status: 'connected',
  credentials: { access_token: 'page-token' },
  configuration: {},
  lastSync: null,
  errorMessage: null,
}

function fakeAdapter() {
  const setTyping = vi.fn().mockResolvedValue(undefined)
  return {
    setTyping,
  } as Pick<ChannelAdapter, 'setTyping'> & { setTyping: ReturnType<typeof vi.fn> }
}

describe('withTypingIndicator', () => {
  it('turns typing on before the task and off after it', async () => {
    const adapter = fakeAdapter()
    const result = await withTypingIndicator(adapter, connection, 'psid-1', async () => 'ok')

    expect(result).toBe('ok')
    expect(adapter.setTyping).toHaveBeenCalledTimes(2)
    expect(adapter.setTyping).toHaveBeenNthCalledWith(1, connection, 'psid-1', true)
    expect(adapter.setTyping).toHaveBeenNthCalledWith(2, connection, 'psid-1', false)
  })

  it('re-asserts typing on a heartbeat while the task is pending', async () => {
    vi.useFakeTimers()
    try {
      const adapter = fakeAdapter()
      let resolveTask: () => void = () => undefined
      const task = new Promise<void>((resolve) => {
        resolveTask = resolve
      })

      const pending = withTypingIndicator(adapter, connection, 'psid-1', () => task)

      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(TYPING_REFRESH_MS * 2)
      resolveTask()
      await pending

      const onCalls = adapter.setTyping.mock.calls.filter(([, , isTyping]) => isTyping === true)
      expect(onCalls.length).toBe(3)
      expect(adapter.setTyping).toHaveBeenLastCalledWith(connection, 'psid-1', false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('always clears typing when the task throws', async () => {
    const adapter = fakeAdapter()
    await expect(
      withTypingIndicator(adapter, connection, 'psid-1', async () => {
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')

    expect(adapter.setTyping).toHaveBeenLastCalledWith(connection, 'psid-1', false)
  })

  it('ignores presence failures and still runs the task', async () => {
    const adapter = fakeAdapter()
    adapter.setTyping
      .mockRejectedValueOnce(new Error('presence failed'))
      .mockResolvedValueOnce(undefined)

    const result = await withTypingIndicator(adapter, connection, 'psid-1', async () => 42)

    expect(result).toBe(42)
    expect(adapter.setTyping).toHaveBeenCalledTimes(2)
  })

  it('runs the task unchanged when the adapter has no typing support', async () => {
    const result = await withTypingIndicator({}, connection, 'psid-1', async () => 'plain')
    expect(result).toBe('plain')
  })
})
