'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface HoverIntentResult {
  intent: boolean
  hoverProps: {
    onPointerEnter: () => void
    onPointerLeave: () => void
  }
}

export function useHoverIntent(delayMs = 120): HoverIntentResult {
  const [intent, setIntent] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const onPointerEnter = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (aliveRef.current) setIntent(true)
    }, delayMs)
  }, [delayMs])

  const onPointerLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setIntent(false)
  }, [])

  return { intent, hoverProps: { onPointerEnter, onPointerLeave } }
}
