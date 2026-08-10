'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface HoverIntentResult {
  intent: boolean
  hoverProps: {
    onPointerEnter: () => void
    onPointerLeave: () => void
  }
}

export function useHoverIntent(delayMs = 120, leaveDelayMs = 0): HoverIntentResult {
  const [intent, setIntent] = useState(false)
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current)
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    }
  }, [])

  const onPointerEnter = useCallback(() => {
    if (enterTimerRef.current) clearTimeout(enterTimerRef.current)
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    enterTimerRef.current = setTimeout(() => {
      if (aliveRef.current) setIntent(true)
    }, delayMs)
  }, [delayMs])

  const onPointerLeave = useCallback(() => {
    if (enterTimerRef.current) clearTimeout(enterTimerRef.current)
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    if (leaveDelayMs > 0) {
      leaveTimerRef.current = setTimeout(() => {
        if (aliveRef.current) setIntent(false)
      }, leaveDelayMs)
    } else {
      setIntent(false)
    }
  }, [leaveDelayMs])

  return { intent, hoverProps: { onPointerEnter, onPointerLeave } }
}
