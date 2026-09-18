import type { ChannelAdapter, ChannelConnection } from './types'

/**
 * Facebook keeps the "escribiendo…" bubble visible for ~10s, so the indicator
 * is re-asserted while the runtime generates the reply. MIA answers in a single
 * long HTTP call, hence the heartbeat + guaranteed teardown.
 */
export const TYPING_REFRESH_MS = 8_000

export async function withTypingIndicator<T>(
  adapter: Pick<ChannelAdapter, 'setTyping'>,
  connection: ChannelConnection,
  externalId: string,
  task: () => Promise<T>
): Promise<T> {
  const setTyping = adapter.setTyping?.bind(adapter)
  if (!setTyping) return task()

  await setTyping(connection, externalId, true).catch(() => undefined)

  const heartbeat = setInterval(() => {
    void setTyping(connection, externalId, true).catch(() => undefined)
  }, TYPING_REFRESH_MS)

  try {
    return await task()
  } finally {
    clearInterval(heartbeat)
    await setTyping(connection, externalId, false).catch(() => undefined)
  }
}
