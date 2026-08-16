import { useRef, useState } from 'react'

const MIN_VISIBLE_MS = 600

/**
 * Controla el indicador "escribiendo…" con un mínimo de visibilidad para que
 * no se perciba instantáneo cuando MIA responde rápido.
 *
 * - startTyping(): muestra el indicador (cancela cualquier ocultado pendiente).
 * - stopTyping(): lo oculta, garantizando que permanezca al menos
 *   `minVisibleMs` desde que se encendió. Idempotente.
 */
export function useTypingIndicator(minVisibleMs = MIN_VISIBLE_MS) {
  const [isTyping, setIsTyping] = useState(false)
  const startedAtRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startTyping = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    startedAtRef.current = Date.now()
    setIsTyping(true)
  }

  const stopTyping = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const remaining = minVisibleMs - (Date.now() - startedAtRef.current)
    if (remaining > 0) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        setIsTyping(false)
      }, remaining)
    } else {
      setIsTyping(false)
    }
  }

  return { isTyping, startTyping, stopTyping }
}
