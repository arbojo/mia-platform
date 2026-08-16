import { describe, it, expect, vi } from 'vitest'
import { withTypingPresence, PRESENCE_REFRESH_MS, type PresenceSocket } from './presence.js'

function fakeSocket() {
  const sendPresenceUpdate = vi.fn().mockResolvedValue({})
  return {
    sendPresenceUpdate,
  } as unknown as PresenceSocket & { sendPresenceUpdate: ReturnType<typeof vi.fn> }
}

describe('withTypingPresence', () => {
  it('sends composing before the task and paused after it', async () => {
    const socket = fakeSocket()
    const result = await withTypingPresence(socket, 'jid@wa', async () => 'ok')

    expect(result).toBe('ok')
    expect(socket.sendPresenceUpdate).toHaveBeenCalledTimes(2)
    expect(socket.sendPresenceUpdate).toHaveBeenNthCalledWith(1, 'composing', 'jid@wa')
    expect(socket.sendPresenceUpdate).toHaveBeenNthCalledWith(2, 'paused', 'jid@wa')
  })

  it('re-asserts composing on a heartbeat while the task is pending', async () => {
    vi.useFakeTimers()
    try {
      const socket = fakeSocket()
      let resolveTask: () => void = () => undefined
      const task = new Promise<void>((resolve) => {
        resolveTask = resolve
      })

      const pending = withTypingPresence(socket, 'jid@wa', () => task)

      // Deja que el composing inicial resuelva y el heartbeat se registre.
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(PRESENCE_REFRESH_MS * 2)
      resolveTask()
      await pending

      expect(socket.sendPresenceUpdate.mock.calls.filter(([type]) => type === 'composing').length).toBe(
        3
      )
      expect(socket.sendPresenceUpdate).toHaveBeenLastCalledWith('paused', 'jid@wa')
    } finally {
      vi.useRealTimers()
    }
  })

  it('always pauses when the task throws', async () => {
    const socket = fakeSocket()
    await expect(
      withTypingPresence(socket, 'jid@wa', async () => {
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')

    expect(socket.sendPresenceUpdate).toHaveBeenLastCalledWith('paused', 'jid@wa')
  })

  it('ignores presence failures and still runs the task', async () => {
    const socket = fakeSocket()
    socket.sendPresenceUpdate
      .mockRejectedValueOnce(new Error('presence failed'))
      .mockResolvedValueOnce({})

    const result = await withTypingPresence(socket, 'jid@wa', async () => 42)

    expect(result).toBe(42)
    expect(socket.sendPresenceUpdate).toHaveBeenCalledTimes(2)
  })
})
