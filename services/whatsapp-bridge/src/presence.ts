/**
 * Presencia de "escribiendo…" para WhatsApp.
 *
 * WhatsApp muestra el indicador de escritura mientras recibe presence
 * 'composing' y lo apaga con 'paused' (o automáticamente a los ~20s). MIA
 * genera la respuesta en una sola llamada HTTP, así que este helper mantiene
 * 'composing' vivo con un heartbeat mientras dura la tarea (ej. la llamada al
 * webhook) y siempre cierra con 'paused' para que el indicador nunca quede
 * encendido, aunque la tarea falle o no haya respuesta.
 */

export const PRESENCE_REFRESH_MS = 15_000

export interface PresenceSocket {
  sendPresenceUpdate(type: 'composing' | 'paused', toJid?: string): Promise<unknown>
}

export async function withTypingPresence<T>(
  socket: PresenceSocket,
  jid: string,
  task: () => Promise<T>
): Promise<T> {
  await socket.sendPresenceUpdate('composing', jid).catch(() => undefined)

  const heartbeat = setInterval(() => {
    socket.sendPresenceUpdate('composing', jid).catch(() => undefined)
  }, PRESENCE_REFRESH_MS)

  try {
    return await task()
  } finally {
    clearInterval(heartbeat)
    await socket.sendPresenceUpdate('paused', jid).catch(() => undefined)
  }
}
